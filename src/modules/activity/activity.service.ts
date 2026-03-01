import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
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

      const userId = user._id.toString();

      const syncTimestamp = new Date(syncDto.sync_timestamp);
      if (isNaN(syncTimestamp.getTime())) {
        throw new BadRequestException('Invalid sync_timestamp (must be ISO 8601)');
      }

      // Start a database session for atomic transaction
      session = await this.activityModel.startSession();
      session.startTransaction();

      // Sync project buckets atomically
      await this.syncProjectBuckets(userId, syncDto.data, syncTimestamp, session);

      // Update user's activity_sync_at timestamp within the transaction
      const now = new Date();
      await this.userModel.updateOne(
        { _id: user._id },
        { $set: { activity_sync_at: now } },
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
        sync_timestamp: now.toISOString(),
        user: {
          id: updatedUser._id,
          email: updatedUser.email,
          name: updatedUser.name,
          profile_photo: updatedUser.profilePhoto,
          activity_sync_at: updatedUser.activity_sync_at?.toISOString() || null,
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
    userId: string,
    buckets: ProjectSyncDto[],
    clientTimestamp: Date,
    session: ClientSession,
  ) {
    for (const bucket of buckets) {
      await this.upsertProject(userId, bucket, clientTimestamp, session);
      await this.upsertDailyActivities(userId, bucket, clientTimestamp, session);
    }

    this.logger.debug(`✓ Synced ${buckets.length} project bucket(s)`);
  }

  private async upsertProject(
    userId: string,
    bucket: ProjectSyncDto,
    syncTimestamp: Date,
    session: ClientSession,
  ) {
    const lastActiveAt = bucket.metadata?.last_active_at
      ? new Date(bucket.metadata.last_active_at)
      : syncTimestamp;

    const firstSeenAt = bucket.metadata?.first_seen_at
      ? new Date(bucket.metadata.first_seen_at)
      : syncTimestamp;

    const update: Record<string, any> = {
      $set: {
        last_active_at: isNaN(lastActiveAt.getTime()) ? new Date() : lastActiveAt,
      },
      $setOnInsert: {
        first_seen_at: isNaN(firstSeenAt.getTime()) ? new Date() : firstSeenAt,
      },
    };

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

    // Update current_loc snapshots if provided
    if (bucket.current_loc && bucket.current_loc.length > 0) {
      for (const loc of bucket.current_loc) {
        await this.projectModel.updateOne(
          {
            user_id: userId,
            project_name: bucket.project_name,
          },
          {
            $set: {
              [`languages.${loc.language}`]: {
                lines_of_code: loc.lines,
                file_count: loc.files,
                last_scanned_at: new Date(),
              },
            },
          },
          { session },
        );
      }
    }
  }

  private async upsertDailyActivities(
    userId: string,
    bucket: ProjectSyncDto,
    syncTimestamp: Date,
    session: ClientSession,
  ) {
    for (const day of bucket.days) {
      const date = new Date(day.date);
      if (isNaN(date.getTime())) {
        throw new BadRequestException(
          `Invalid date in days bucket for project ${bucket.project_name}: ${day.date}`,
        );
      }
      date.setUTCHours(0, 0, 0, 0);

      const $set: Record<string, any> = {
        last_synced_at: syncTimestamp,
      };

      // Languages, apps, skills, context are now direct maps
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

      if (day.skills && Object.keys(day.skills).length > 0) {
        for (const [name, duration] of Object.entries(day.skills)) {
          $set[`skills.${name}`] = duration;
        }
      }

      if (day.context && Object.keys(day.context).length > 0) {
        for (const [name, duration] of Object.entries(day.context)) {
          $set[`context_states.${name}`] = duration;
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
  private async getActivityStatsByUserId(userId: string) {
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
