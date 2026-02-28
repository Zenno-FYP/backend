import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { Activity } from './schemas/activity.schema';
import { Project } from './schemas/project.schema';
import { User } from '../user/schemas/user.schema';
import { SyncActivityDto } from './dto/sync-activity.dto';

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

      // Start a database session for atomic transaction
      session = await this.activityModel.startSession();
      session.startTransaction();

      // Sync activity data atomically
      await this.syncDailyActivities(email, syncDto.data, session);
      await this.syncProjects(email, syncDto.data, session);

      // Commit transaction
      await session.commitTransaction();

      // Update user's activity_sync_at timestamp
      const syncTimestamp = new Date();
      const updatedUser = await this.userModel.findOneAndUpdate(
        { email },
        { activity_sync_at: syncTimestamp },
        { new: true },
      );

      if (!updatedUser) {
        throw new BadRequestException('User not found after sync');
      }

      const syncStats = await this.getActivityStats(email);

      this.logger.log(`✓ Activity synced successfully for user: ${email}`);

      return {
        success: true,
        message: 'Activity synced successfully',
        sync_timestamp: syncTimestamp.toISOString(),
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

  /**
   * Sync daily activity metrics (languages, apps, skills, context, behavior)
   */
  private async syncDailyActivities(
    email: string,
    data: any,
    session: ClientSession,
  ) {
    // Get user to find their user_id (Firebase UID)
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found during sync');
    }

    const userId = user._id.toString();

    // Process each daily activity type
    if (data.daily_languages && data.daily_languages.length > 0) {
      await this.syncDailyLanguages(userId, data.daily_languages, session);
    }

    if (data.daily_apps && data.daily_apps.length > 0) {
      await this.syncDailyApps(userId, data.daily_apps, session);
    }

    if (data.daily_skills && data.daily_skills.length > 0) {
      await this.syncDailySkills(userId, data.daily_skills, session);
    }

    if (data.daily_context && data.daily_context.length > 0) {
      await this.syncDailyContext(userId, data.daily_context, session);
    }

    if (data.daily_behavior && data.daily_behavior.length > 0) {
      await this.syncDailyBehavior(userId, data.daily_behavior, session);
    }
  }

  /**
   * Sync project metadata and LOC snapshots
   */
  private async syncProjects(
    email: string,
    data: any,
    session: ClientSession,
  ) {
    if (!data.loc_snapshots || data.loc_snapshots.length === 0) {
      return;
    }

    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found during project sync');
    }

    for (const snapshot of data.loc_snapshots) {
      await this.projectModel.findOneAndUpdate(
        {
          user_id: user._id.toString(),
          project_name: snapshot.project_name,
        },
        {
          $set: {
            [`languages.${snapshot.language_name}`]: {
              lines_of_code: snapshot.lines_of_code,
              file_count: snapshot.file_count,
              last_scanned_at: new Date(snapshot.last_scanned_at),
            },
            last_active_at: new Date(),
          },
        },
        { upsert: true, session },
      );
    }

    this.logger.debug(
      `✓ Synced ${data.loc_snapshots.length} LOC snapshots for ${email}`,
    );
  }

  private async syncDailyLanguages(
    userId: string,
    languages: any[],
    session: ClientSession,
  ) {
    for (const lang of languages) {
      const date = new Date(lang.date);
      date.setUTCHours(0, 0, 0, 0); // Normalize to start of day

      await this.activityModel.findOneAndUpdate(
        {
          user_id: userId,
          project_name: lang.project_name,
          date,
        },
        {
          $set: {
            [`languages.${lang.language_name}`]: lang.duration_sec,
          },
        },
        { upsert: true, session },
      );
    }

    this.logger.debug(`✓ Synced ${languages.length} language records`);
  }

  private async syncDailyApps(
    userId: string,
    apps: any[],
    session: ClientSession,
  ) {
    for (const app of apps) {
      const date = new Date(app.date);
      date.setUTCHours(0, 0, 0, 0);

      await this.activityModel.findOneAndUpdate(
        {
          user_id: userId,
          project_name: app.project_name,
          date,
        },
        {
          $set: {
            [`apps.${app.app_name}`]: app.duration_sec,
          },
        },
        { upsert: true, session },
      );
    }

    this.logger.debug(`✓ Synced ${apps.length} app records`);
  }

  private async syncDailySkills(
    userId: string,
    skills: any[],
    session: ClientSession,
  ) {
    for (const skill of skills) {
      const date = new Date(skill.date);
      date.setUTCHours(0, 0, 0, 0);

      await this.activityModel.findOneAndUpdate(
        {
          user_id: userId,
          project_name: skill.project_name,
          date,
        },
        {
          $set: {
            [`skills.${skill.skill_name}`]: skill.duration_sec,
          },
        },
        { upsert: true, session },
      );
    }

    this.logger.debug(`✓ Synced ${skills.length} skill records`);
  }

  private async syncDailyContext(
    userId: string,
    contexts: any[],
    session: ClientSession,
  ) {
    for (const ctx of contexts) {
      const date = new Date(ctx.date);
      date.setUTCHours(0, 0, 0, 0);

      await this.activityModel.findOneAndUpdate(
        {
          user_id: userId,
          project_name: ctx.project_name,
          date,
        },
        {
          $set: {
            [`context_states.${ctx.context_state}`]: ctx.duration_sec,
          },
        },
        { upsert: true, session },
      );
    }

    this.logger.debug(`✓ Synced ${contexts.length} context records`);
  }

  private async syncDailyBehavior(
    userId: string,
    behaviors: any[],
    session: ClientSession,
  ) {
    for (const behavior of behaviors) {
      const date = new Date(behavior.date);
      date.setUTCHours(0, 0, 0, 0);

      await this.activityModel.findOneAndUpdate(
        {
          user_id: userId,
          project_name: behavior.project_name,
          date,
        },
        {
          $set: {
            behavior: {
              total_keystrokes: behavior.total_keystrokes,
              total_mouse_clicks: behavior.total_mouse_clicks,
              total_scroll_events: behavior.total_scroll_events,
              total_idle_sec: behavior.total_idle_sec,
            },
          },
        },
        { upsert: true, session },
      );
    }

    this.logger.debug(`✓ Synced ${behaviors.length} behavior records`);
  }

  /**
   * Get aggregate statistics for the user
   */
  private async getActivityStats(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found while getting stats');
    }

    const activityCount = await this.activityModel.countDocuments({
      user_id: user._id.toString(),
    });
    const projectCount = await this.projectModel.countDocuments({
      user_id: user._id.toString(),
    });

    return {
      total_activity_records: activityCount,
      total_projects: projectCount,
    };
  }
}
