import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activity } from '../activity/schemas/activity.schema';
import { Project } from '../activity/schemas/project.schema';
import { User } from '../user/schemas/user.schema';
import { ToolUsageResponseDto } from './dto/tool-usage.dto';
import { AppCategoryUsageDto, DailyAppUsageDto, ToolUsageDetailResponseDto } from './dto/tool-usage-detail.dto';
import { categorizeAppName } from './app-category.mapper';

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
   * Detail page: expanded lists, per-day app hours, and unique app count.
   */
  async getToolUsageDetail(email: string): Promise<ToolUsageDetailResponseDto> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const userId = user._id as Types.ObjectId;

    let today: Date;
    if (user.timezone_offset !== undefined && user.timezone_offset !== null) {
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
      today = new Date();
      today.setUTCHours(0, 0, 0, 0);
    }

    const currentStart = new Date(today);
    currentStart.setUTCDate(today.getUTCDate() - 6);

    const previousStart = new Date(today);
    previousStart.setUTCDate(today.getUTCDate() - 13);

    const previousEnd = new Date(today);
    previousEnd.setUTCDate(today.getUTCDate() - 7);

    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);

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

    const currentAppMap = this.aggregateAppDurations(currentActivities);
    const uniqueAppsCount = currentAppMap.size;

    const topApps = this.calculateTopApps(
      currentActivities,
      previousActivities,
      yesterdayActivities,
      10,
    );

    const languageDistribution = await this.calculateLanguageDistribution(userId, 15);

    const dailyAppUsage = this.buildDailyAppUsage(currentActivities, currentStart);

    const categoryBreakdown = this.aggregateHoursByCategory(currentAppMap);

    return {
      period: 'last_7_days',
      unique_apps_count: uniqueAppsCount,
      category_breakdown: categoryBreakdown,
      daily_app_usage: dailyAppUsage,
      top_apps: topApps,
      language_distribution: languageDistribution,
    };
  }

  /**
   * Sum hours per inferred app category (all apps in the period, not only top N).
   */
  private aggregateHoursByCategory(appMap: Map<string, number>): AppCategoryUsageDto[] {
    const catMap = new Map<string, number>();
    for (const [name, hours] of appMap) {
      const cat = categorizeAppName(name);
      catMap.set(cat, (catMap.get(cat) || 0) + hours);
    }
    const total = Array.from(catMap.values()).reduce((a, b) => a + b, 0);
    const rows: AppCategoryUsageDto[] = Array.from(catMap.entries()).map(([category, hours]) => ({
      category,
      hours: Math.round(hours * 100) / 100,
      percent_of_total:
        total > 0 ? Math.round(((hours / total) * 100 + Number.EPSILON) * 10) / 10 : 0,
    }));
    rows.sort((a, b) => b.hours - a.hours);
    return rows;
  }

  /**
   * Sum app seconds per calendar day (all projects) for the 7-day window.
   */
  private buildDailyAppUsage(activities: Activity[], startDate: Date): DailyAppUsageDto[] {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result: DailyAppUsageDto[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setUTCDate(startDate.getUTCDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      let totalSec = 0;
      for (const activity of activities) {
        const actDate = activity.date.toISOString().split('T')[0];
        if (actDate !== dateStr) continue;
        if (!activity.apps) continue;
        const apps =
          activity.apps instanceof Map ? activity.apps : new Map(Object.entries(activity.apps || {}));
        for (const [, durationSeconds] of apps) {
          totalSec += (durationSeconds as number) || 0;
        }
      }

      const totalHours = Math.round((totalSec / 3600) * 100) / 100;
      result.push({
        date: dateStr,
        day_name: dayNames[date.getUTCDay()],
        total_hours: totalHours,
      });
    }

    return result;
  }

  /**
   * Calculate top apps with usage stats
   */
  private calculateTopApps(
    currentActivities: Activity[],
    previousActivities: Activity[],
    yesterdayActivities: Activity[],
    topLimit = 5,
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

    // Sort apps by duration and get top N
    const topAppsList = Array.from(currentAppMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topLimit)
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
  private async calculateLanguageDistribution(userId: Types.ObjectId, topLimit = 5) {
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

    // Sort languages by LOC and get top N
    const topLanguages = Array.from(languageMap.entries())
      .sort((a, b) => b[1].loc - a[1].loc)
      .slice(0, topLimit)
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
