import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activity } from '../activity/schemas/activity.schema';
import { Project } from '../activity/schemas/project.schema';
import { User } from '../user/schemas/user.schema';
import { ToolUsageResponseDto } from './dto/tool-usage.dto';

@Injectable()
export class ToolUsageService {
  constructor(
    @InjectModel(Activity.name) private activityModel: Model<Activity>,
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  /**
   * Get tool usage metrics: top apps and language distribution
   */
  async getToolUsage(email: string): Promise<ToolUsageResponseDto> {
    // Verify user exists
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const userId = user._id as Types.ObjectId;

    // Calculate user's local "today" using stored timezone offset
    let today: Date;
    if (user.timezone_offset !== undefined && user.timezone_offset !== null) {
      // Use stored timezone offset
      const now = new Date();
      const userLocalNow = new Date(now.getTime() + user.timezone_offset * 60 * 60 * 1000);
      today = new Date(
        Date.UTC(
          userLocalNow.getUTCFullYear(),
          userLocalNow.getUTCMonth(),
          userLocalNow.getUTCDate(),
        ),
      );
    } else {
      // Fallback to server UTC if no timezone offset stored
      today = new Date();
      today.setUTCHours(0, 0, 0, 0);
    }

    // Current period: Last 7 days
    const currentStart = new Date(today);
    currentStart.setUTCDate(today.getUTCDate() - 6);

    // Yesterday
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);

    // Previous period: Last 7 days before current
    const previousStart = new Date(today);
    previousStart.setUTCDate(today.getUTCDate() - 13);

    const previousEnd = new Date(today);
    previousEnd.setUTCDate(today.getUTCDate() - 7);

    // Fetch activities
    const [currentActivities, previousActivities, yesterdayActivities] = await Promise.all([
      this.activityModel.find({
        user_id: userId,
        date: { $gte: currentStart, $lte: today },
      }),
      this.activityModel.find({
        user_id: userId,
        date: { $gte: previousStart, $lt: previousEnd },
      }),
      this.activityModel.find({
        user_id: userId,
        date: { $gte: yesterday, $lt: today },
      }),
    ]);

    // Calculate top apps
    const topApps = this.calculateTopApps(
      currentActivities,
      previousActivities,
      yesterdayActivities,
    );

    // Calculate language distribution
    const languageDistribution = await this.calculateLanguageDistribution(userId);

    return {
      period: 'last_7_days',
      top_apps: topApps,
      language_distribution: languageDistribution,
    };
  }

  /**
   * Calculate top apps with usage stats
   */
  private calculateTopApps(
    currentActivities: Activity[],
    previousActivities: Activity[],
    yesterdayActivities: Activity[],
  ) {
    // Aggregate app durations for each period
    const currentAppMap = this.aggregateAppDurations(currentActivities);
    const previousAppMap = this.aggregateAppDurations(previousActivities);
    const yesterdayAppMap = this.aggregateAppDurations(yesterdayActivities);

    // Total usage hours for current period
    const totalUsageHours = Array.from(currentAppMap.values()).reduce((a, b) => a + b, 0);

    // Total usage hours for yesterday
    const yesterdayTotal = Array.from(yesterdayAppMap.values()).reduce((a, b) => a + b, 0);

    // Calculate headline trend
    const usageIncreaseFromYesterdayPercent =
      yesterdayTotal > 0
        ? Math.round(((totalUsageHours - yesterdayTotal) / yesterdayTotal) * 1000) / 10
        : totalUsageHours > 0
          ? 100
          : 0;

    // Sort apps by duration and get top 5
    const topAppsList = Array.from(currentAppMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([appName, duration]) => {
        const percentOfTotal = totalUsageHours > 0 ? (duration / totalUsageHours) * 100 : 0;
        const previousDuration = previousAppMap.get(appName) || 0;
        const changePercent =
          previousDuration > 0
            ? Math.round(((duration - previousDuration) / previousDuration) * 1000) / 10
            : duration > 0
              ? 100
              : 0;

        return {
          name: appName,
          duration_hours: Math.round(duration * 100) / 100,
          percent_of_total: Math.round(percentOfTotal * 10) / 10,
          change_percent: changePercent,
        };
      });

    return {
      total_usage_hours: Math.round(totalUsageHours * 100) / 100,
      usage_increase_from_yesterday_percent: usageIncreaseFromYesterdayPercent,
      apps: topAppsList,
    };
  }

  /**
   * Aggregate app durations from activities
   */
  private aggregateAppDurations(activities: Activity[]): Map<string, number> {
    const appMap = new Map<string, number>();
    for (const activity of activities) {
      if (activity.apps) {
        const apps = activity.apps instanceof Map ? activity.apps : new Map(Object.entries(activity.apps || {}));
        for (const [appName, durationSeconds] of apps) {
          const durationHours = ((durationSeconds as number) || 0) / 3600;
          appMap.set(appName, (appMap.get(appName) || 0) + durationHours);
        }
      }
    }
    return appMap;
  }

  /**
   * Calculate language distribution from project code snapshots
   */
  private async calculateLanguageDistribution(userId: Types.ObjectId) {
    // Fetch all projects for the user
    const projects = await this.projectModel.find({
      user_id: userId,
    });

    // Aggregate language data from current_loc
    const languageMap = new Map<string, { loc: number; files: number }>();
    let totalLoc = 0;
    let totalFiles = 0;

    for (const project of projects) {
      if (project.current_loc && Array.isArray(project.current_loc)) {
        for (const locItem of project.current_loc) {
          const lang = locItem.language || 'Unknown';
          const lines = locItem.lines || 0;
          const files = locItem.files || 0;

          if (!languageMap.has(lang)) {
            languageMap.set(lang, { loc: 0, files: 0 });
          }

          const current = languageMap.get(lang);
          if (current) {
            current.loc += lines;
            current.files += files;
            totalLoc += lines;
            totalFiles += files;
          }
        }
      }
    }

    // Sort languages by LOC and get top 5
    const topLanguages = Array.from(languageMap.entries())
      .sort((a, b) => b[1].loc - a[1].loc)
      .slice(0, 5)
      .map(([lang, data]) => {
        const percent = totalLoc > 0 ? (data.loc / totalLoc) * 100 : 0;
        return {
          name: lang,
          percent: Math.round(percent * 10) / 10,
          loc: data.loc,
          files: data.files,
        };
      });

    return {
      summary: {
        total_lines_of_code: totalLoc,
        total_files: totalFiles,
        total_languages_used: languageMap.size,
      },
      languages: topLanguages,
    };
  }
}
