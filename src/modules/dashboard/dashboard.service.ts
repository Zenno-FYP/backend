import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activity } from '../activity/schemas/activity.schema';
import { User } from '../user/schemas/user.schema';
import { PerformanceMetricsResponseDto, UsageTrendBarDto } from './dto/dashboard-metrics.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Activity.name) private activityModel: Model<Activity>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  /**
   * Get dashboard performance metrics for current 7 days vs previous 7 days
   * Current Period: [Today] back to [Today - 6 days] (7 days inclusive)
   * Previous Period: [Today - 7 days] back to [Today - 13 days]
   */
  async getPerformanceMetrics(email: string): Promise<PerformanceMetricsResponseDto> {
    // Verify user exists and get their MongoDB _id
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const userId = user._id;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Current period: Today to Today-6 days (7 days inclusive)
    const currentStart = new Date(today);
    currentStart.setUTCDate(today.getUTCDate() - 6);

    // Previous period: Today-7 days to Today-13 days
    const previousStart = new Date(today);
    previousStart.setUTCDate(today.getUTCDate() - 13);

    const previousEnd = new Date(today);
    previousEnd.setUTCDate(today.getUTCDate() - 7);

    // Fetch current and previous period activities
    const [currentActivities, previousActivities] = await Promise.all([
      this.activityModel.find({
        user_id: userId,
        date: { $gte: currentStart, $lte: today },
      }),
      this.activityModel.find({
        user_id: userId,
        date: { $gte: previousStart, $lt: previousEnd },
      }),
    ]);

    // Calculate metrics for both periods
    const currentMetrics = this.calculateMetrics(currentActivities);
    const previousMetrics = this.calculateMetrics(previousActivities);

    // Build performance summary metrics with trends
    const performanceSummary = {
      wpm: {
        value: Math.round(currentMetrics.wpm * 100) / 100,
        change_percent: this.calculateTrendPercent(currentMetrics.wpm, previousMetrics.wpm),
      },
      daily_active_average: {
        value: Math.round(currentMetrics.dailyActiveAverage * 100) / 100,
        change_percent: this.calculateTrendPercent(
          currentMetrics.dailyActiveAverage,
          previousMetrics.dailyActiveAverage,
        ),
      },
      total_clicks: {
        value: currentMetrics.totalClicks,
        change_percent: this.calculateTrendPercent(
          currentMetrics.totalClicks,
          previousMetrics.totalClicks,
        ),
      },
      total_scrolls: {
        value: currentMetrics.totalScrolls,
        change_percent: this.calculateTrendPercent(
          currentMetrics.totalScrolls,
          previousMetrics.totalScrolls,
        ),
      },
    };

    // Generate usage trend graph (7 days)
    const usageTrendGraph = this.generateUsageTrend(currentActivities, currentStart);

    return {
      period: 'last_7_days',
      sync_timestamp: new Date().toISOString(),
      performance_summary: performanceSummary,
      usage_trend_graph: usageTrendGraph,
    };
  }

  /**
   * Calculate performance metrics from activity records
   * Formulas:
   * - WPM: (Total Keystrokes / 5) / (total context duration in minutes)
   * - Daily Active Average: (total context duration in hours) / number of active days
   */
  private calculateMetrics(activities: Activity[]) {
    if (activities.length === 0) {
      return {
        wpm: 0,
        dailyActiveAverage: 0,
        totalClicks: 0,
        totalScrolls: 0,
        totalIdleHours: 0,
      };
    }

    let totalKeystrokes = 0;
    let totalClicks = 0;
    let totalScrolls = 0;
    let totalDurationSeconds = 0; // All context states: Focused + Reading + Distracted + Idle
    const activeDays = new Set<string>();

    for (const activity of activities) {
      // Behavior metrics
      totalKeystrokes += activity.behavior?.keystrokes || 0;
      totalClicks += activity.behavior?.clicks || 0;
      totalScrolls += activity.behavior?.scrolls || 0;

      // Context durations - sum all context states for total duration
      if (activity.context) {
        const contextEntries = activity.context instanceof Map
          ? Array.from(activity.context.values())
          : Object.values(activity.context);

        for (const duration of contextEntries) {
          totalDurationSeconds += (duration as number) || 0;
        }
      }

      // Count active days
      activeDays.add(activity.date.toISOString().split('T')[0]);
    }

    // WPM calculation: keystrokes per minute (includes all context states)
    const totalActiveMinutes = totalDurationSeconds / 60;
    const wpm = totalActiveMinutes > 0 ? (totalKeystrokes / 5) / totalActiveMinutes : 0;

    // Daily active average: All context durations (Hours) / Count of Active Days
    const totalDurationHours = totalDurationSeconds / 3600;
    const dailyActiveAverage = activeDays.size > 0 ? totalDurationHours / activeDays.size : 0;

    return {
      wpm,
      dailyActiveAverage,
      totalClicks,
      totalScrolls,
    };
  }

  /**
   * Calculate trend percentage: ((Current - Previous) / Previous) * 100
   * Returns 100 if previous is 0 but current > 0
   */
  private calculateTrendPercent(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    const percent = ((current - previous) / previous) * 100;
    return Math.round(percent * 10) / 10;
  }

  /**
   * Generate 7-day usage trend with context breakdown
   * Aggregates all projects per day
   */
  private generateUsageTrend(activities: Activity[], startDate: Date): UsageTrendBarDto[] {
    const dayMap = new Map<string, Activity[]>();

    // Group activities by date (across ALL projects)
    for (const activity of activities) {
      const dateStr = activity.date.toISOString().split('T')[0];
      if (!dayMap.has(dateStr)) {
        dayMap.set(dateStr, []);
      }
      const dayActivities = dayMap.get(dateStr);
      if (dayActivities) {
        dayActivities.push(activity);
      }
    }

    // Generate 7 days of data
    const result: UsageTrendBarDto[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setUTCDate(startDate.getUTCDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayActivities = dayMap.get(dateStr) || [];

      // Calculate hours for each context category (aggregates across all projects)
      const { focused, reading, distracted, idle } = this.categorizeActivities(dayActivities);

      // Total active hours = sum of all context states (Focused + Reading + Distracted + Idle)
      const totalActive = focused + reading + distracted + idle;

      result.push({
        date: dateStr,
        day_name: dayNames[date.getUTCDay()],
        focused_hours: Math.round(focused * 100) / 100,
        reading_hours: Math.round(reading * 100) / 100,
        distracted_hours: Math.round(distracted * 100) / 100,
        idle_hours: Math.round(idle * 100) / 100,
        total_active_hours: Math.round(totalActive * 100) / 100,
      });
    }

    return result;
  }

  private categorizeActivities(
    activities: Activity[],
  ): {
    focused: number;
    reading: number;
    distracted: number;
    idle: number;
  } {
    let focused = 0;
    let reading = 0;
    let distracted = 0;
    let idle = 0;

    for (const activity of activities) {
      if (activity.context) {
        // Handle both Map and plain object for context
        const contextEntries = activity.context instanceof Map
          ? Array.from(activity.context.entries())
          : Object.entries(activity.context);

        for (const [contextType, duration] of contextEntries) {
          const hours = ((duration as number) || 0) / 3600;

          switch (contextType) {
            case 'Focused':
            case 'focused':
              focused += hours;
              break;
            case 'Reading':
            case 'reading':
              reading += hours;
              break;
            case 'Distracted':
            case 'distracted':
              distracted += hours;
              break;
            case 'Idle':
            case 'idle':
              idle += hours;
              break;
          }
        }
      }
    }

    return { focused, reading, distracted, idle };
  }
}
