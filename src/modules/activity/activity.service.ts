import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession, Types } from 'mongoose';
import { Activity } from './schemas/activity.schema';
import { Project } from './schemas/project.schema';
import { User } from '../user/schemas/user.schema';
import {
  ProjectSyncDto,
  SyncActivityDto,
} from './dto/sync-activity.dto';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectModel(Activity.name) private activityModel: Model<Activity>,
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  /**
   * Sync all activity data from desktop agent in a single atomic transaction
   */
  async syncActivity(email: string, syncDto: SyncActivityDto) {
    let session: ClientSession | null = null;

    try {
      // Verify user exists
      const user = await this.userModel.findOne({ email });
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Convert user_id string from DTO to ObjectId
      let userId: Types.ObjectId;
      try {
        userId = new Types.ObjectId(syncDto.user_id);
      } catch (error) {
        throw new BadRequestException('Invalid user_id format (must be valid MongoDB ObjectId)');
      }

      // Verify that the user_id matches the authenticated user
      if (userId.toString() !== user._id.toString()) {
        throw new BadRequestException('user_id does not match authenticated user');
      }

      const syncTimestamp = new Date(syncDto.sync_timestamp);
      if (isNaN(syncTimestamp.getTime())) {
        throw new BadRequestException('Invalid sync_timestamp (must be ISO 8601)');
      }

      // Start a database session for atomic transaction
      session = await this.activityModel.startSession();
      session.startTransaction();

      // Sync project buckets atomically (pass original local time string)
      await this.syncProjectBuckets(userId, syncDto.data, syncDto.sync_timestamp, syncTimestamp, session);

      // Calculate and store timezone offset
      // sync_timestamp is in local time with microseconds (e.g., "2026-03-04T02:01:41.525702")
      // Trim to milliseconds (JavaScript doesn't support microseconds) and treat as UTC reference
      const trimmedTimestamp = syncDto.sync_timestamp.substring(0, 23); // "2026-03-04T02:01:41.525"
      const userLocalAsUtc = new Date(trimmedTimestamp + 'Z').getTime();
      const serverUtcNow = Date.now();
      const offsetHours = Math.round(((userLocalAsUtc - serverUtcNow) / (1000 * 60 * 60)) * 4) / 4; // Round to nearest 15 min
      
      this.logger.debug(`📍 Timezone offset calculated: ${offsetHours} hours from ${syncDto.sync_timestamp}`);

      // Update user's activity_sync_at timestamp and timezone offset within the transaction
      await this.userModel.updateOne(
        { _id: user._id },
        { 
          $set: { 
            activity_sync_at: syncDto.sync_timestamp,
            timezone_offset: offsetHours 
          } 
        },
        { session },
      );

      // Commit transaction
      await session.commitTransaction();

      const updatedUser = await this.userModel.findOne({ email });
      if (!updatedUser) {
        throw new BadRequestException('User not found after sync');
      }

      const syncStats = await this.getActivityStatsByUserId(userId);

      this.logger.log(`✓ Activity synced successfully for user: ${email}`);

      return {
        success: true,
        message: 'Activity synced successfully',
        sync_timestamp: syncDto.sync_timestamp,
        user: {
          id: updatedUser._id,
          email: updatedUser.email,
          name: updatedUser.name,
          profile_photo: updatedUser.profilePhoto,
          activity_sync_at: updatedUser.activity_sync_at || null,
          stats: syncStats,
        },
      };
    } catch (error) {
      if (session) {
        await session.abortTransaction();
      }
      this.logger.error(`Sync failed for ${email}:`, error.message);
      throw new BadRequestException(`Sync failed: ${error.message}`);
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  private async syncProjectBuckets(
    userId: Types.ObjectId,
    buckets: ProjectSyncDto[],
    syncTimestampStr: string,
    syncTimestamp: Date,
    session: ClientSession,
  ) {
    for (const bucket of buckets) {
      await this.upsertProject(userId, bucket, syncTimestampStr, session);
      await this.upsertDailyActivities(userId, bucket, syncTimestampStr, session);
    }

    this.logger.debug(`✓ Synced ${buckets.length} project bucket(s)`);
  }

  private async upsertProject(
    userId: Types.ObjectId,
    bucket: ProjectSyncDto,
    syncTimestampStr: string,
    session: ClientSession,
  ) {
    // Use local time strings from metadata, or fall back to sync timestamp
    const lastActiveAtStr = bucket.metadata?.last_active_at || syncTimestampStr;
    const firstSeenAtStr = bucket.metadata?.first_seen_at || syncTimestampStr;

    // Validate timestamps are valid ISO 8601
    if (isNaN(new Date(lastActiveAtStr).getTime())) {
      throw new BadRequestException(`Invalid last_active_at timestamp: ${lastActiveAtStr}`);
    }
    if (isNaN(new Date(firstSeenAtStr).getTime())) {
      throw new BadRequestException(`Invalid first_seen_at timestamp: ${firstSeenAtStr}`);
    }

    // Check if project already exists
    const existingProject = await this.projectModel.findOne(
      {
        user_id: userId,
        project_name: bucket.project_name,
      },
      null,
      { session },
    );

    const update: Record<string, any> = {
      $set: {
        last_active_at: lastActiveAtStr,
      },
    };

    // Only set first_seen_at if project is NEW (doesn't exist yet)
    if (!existingProject) {
      update.$set.first_seen_at = firstSeenAtStr;
    }

    await this.projectModel.findOneAndUpdate(
      {
        user_id: userId,
        project_name: bucket.project_name,
      },
      update,
      {
        upsert: true,
        session,
        setDefaultsOnInsert: true,
      },
    );

    // Update current_loc if provided
    if (bucket.current_loc && bucket.current_loc.length > 0) {
      const currentLoc = bucket.current_loc.map((loc) => ({
        language: loc.language,
        lines: loc.lines,
        files: loc.files,
      }));

      await this.projectModel.updateOne(
        {
          user_id: userId,
          project_name: bucket.project_name,
        },
        {
          $set: {
            current_loc: currentLoc,
          },
        },
        { session },
      );
    }

    // Update project_skills if provided (cumulative skills breakdown)
    if (bucket.project_skills && bucket.project_skills.length > 0) {
      const projectSkills = bucket.project_skills.map((skill) => ({
        skill_name: skill.skill_name,
        duration_sec: skill.duration_sec,
      }));

      await this.projectModel.updateOne(
        {
          user_id: userId,
          project_name: bucket.project_name,
        },
        {
          $set: {
            project_skills: projectSkills,
          },
        },
        { session },
      );
    }
  }

  private async upsertDailyActivities(
    userId: Types.ObjectId,
    bucket: ProjectSyncDto,
    syncTimestampStr: string,
    session: ClientSession,
  ) {
    for (const day of bucket.days) {
      // Parse local date string (YYYY-MM-DD) as UTC midnight
      // This preserves the local date without timezone conversion
      const date = new Date(day.date + 'T00:00:00Z');
      if (isNaN(date.getTime())) {
        throw new BadRequestException(
          `Invalid date in days bucket for project ${bucket.project_name}: ${day.date}`,
        );
      }

      const $set: Record<string, any> = {
        // last_synced_at preserves local time string exactly as sent from desktop
        last_synced_at: syncTimestampStr,
      };

      // Languages, apps, context are direct maps
      if (day.languages && Object.keys(day.languages).length > 0) {
        for (const [name, duration] of Object.entries(day.languages)) {
          $set[`languages.${name}`] = duration;
        }
      }

      if (day.apps && Object.keys(day.apps).length > 0) {
        for (const [name, duration] of Object.entries(day.apps)) {
          $set[`apps.${name}`] = duration;
        }
      }

      if (day.context && Object.keys(day.context).length > 0) {
        for (const [name, duration] of Object.entries(day.context)) {
          $set[`context.${name}`] = duration;
        }
      }

      if (day.behavior) {
        $set.behavior = {
          keystrokes: day.behavior.keystrokes,
          clicks: day.behavior.clicks,
          scrolls: day.behavior.scrolls,
          idle_sec: day.behavior.idle_sec,
        };
      }

      await this.activityModel.findOneAndUpdate(
        {
          user_id: userId,
          project_name: bucket.project_name,
          date,
        },
        {
          $set,
          $setOnInsert: {
            sync_version: 1,
          },
        },
        {
          upsert: true,
          session,
          setDefaultsOnInsert: true,
        },
      );
    }
  }

  /**
   * Get aggregate statistics for the user
   */
  private async getActivityStatsByUserId(userId: Types.ObjectId) {
    const activityCount = await this.activityModel.countDocuments({
      user_id: userId,
    });
    const projectCount = await this.projectModel.countDocuments({
      user_id: userId,
    });

    return {
      total_activity_records: activityCount,
      total_projects: projectCount,
    };
  }
}
