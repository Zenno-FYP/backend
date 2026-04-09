import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activity } from '../activity/schemas/activity.schema';
import { Project } from '../activity/schemas/project.schema';
import { User } from '../user/schemas/user.schema';
import { PerformanceMetricsResponseDto, UsageTrendBarDto } from './dto/dashboard-metrics.dto';
import {
  PerformanceMetricsDetailResponseDto,
  DailyBehaviorMetricsDto,
} from './dto/performance-metrics-detail.dto';
import { ProjectInsightsResponseDto } from './dto/project-insights.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Activity.name) private activityModel: Model<Activity>,
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  private getDateRangeForUser(user: User): {
    today: Date;
    currentStart: Date;
    previousStart: Date;
    previousEnd: Date;
  } {
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
    return { today, currentStart, previousStart, previousEnd };
  }

  private mapToPerformanceSummary(
    currentMetrics: {
      avgTypingIntensity: number;
      avgMouseClickRate: number;
      avgCorrections: number;
      dailyActiveAverage: number;
    },
    previousMetrics: {
      avgTypingIntensity: number;
      avgMouseClickRate: number;
      avgCorrections: number;
      dailyActiveAverage: number;
    },
  ) {
    return {
      avg_typing_intensity: {
        value: Math.round(currentMetrics.avgTypingIntensity * 100) / 100,
        change_percent: this.calculateTrendPercent(
          currentMetrics.avgTypingIntensity,
          previousMetrics.avgTypingIntensity,
        ),
      },
      avg_mouse_click_rate: {
        value: Math.round(currentMetrics.avgMouseClickRate * 100) / 100,
        change_percent: this.calculateTrendPercent(
          currentMetrics.avgMouseClickRate,
          previousMetrics.avgMouseClickRate,
        ),
      },
      avg_corrections: {
        value: Math.round(currentMetrics.avgCorrections * 100) / 100,
        change_percent: this.calculateTrendPercent(
          currentMetrics.avgCorrections,
          previousMetrics.avgCorrections,
        ),
      },
      daily_active_average: {
        value: Math.round(currentMetrics.dailyActiveAverage * 100) / 100,
        change_percent: this.calculateTrendPercent(
          currentMetrics.dailyActiveAverage,
          previousMetrics.dailyActiveAverage,
        ),
      },
    };
  }

  /**
   * Get dashboard performance metrics for current 7 days vs previous 7 days
   * Current Period: [Today] back to [Today - 6 days] (7 days inclusive)
   * Previous Period: [Today - 7 days] back to [Today - 13 days]
   */
  async getPerformanceMetrics(email: string): Promise<PerformanceMetricsResponseDto> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const userId = user._id;
    const { today, currentStart, previousStart, previousEnd } = this.getDateRangeForUser(user);

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

    const currentMetrics = this.calculateMetrics(currentActivities);
    const previousMetrics = this.calculateMetrics(previousActivities);
    const performanceSummary = this.mapToPerformanceSummary(currentMetrics, previousMetrics);

    // Generate usage trend graph (7 days)
    const usageTrendGraph = this.generateUsageTrend(currentActivities, currentStart);

    return {
      period: 'last_7_days',
      performance_summary: performanceSummary,
      usage_trend_graph: usageTrendGraph,
    };
  }

  /**
   * Performance metrics detail: same summary as the dashboard home, plus per-day behavior from activities.
   */
  async getPerformanceMetricsDetail(email: string): Promise<PerformanceMetricsDetailResponseDto> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const userId = user._id;
    const { today, currentStart, previousStart, previousEnd } = this.getDateRangeForUser(user);

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

    const currentMetrics = this.calculateMetrics(currentActivities);
    const previousMetrics = this.calculateMetrics(previousActivities);
    const performanceSummary = this.mapToPerformanceSummary(currentMetrics, previousMetrics);
    const dailySeries = this.generateDailyBehaviorSeries(currentActivities, currentStart);

    return {
      period: 'last_7_days',
      performance_summary: performanceSummary,
      daily_series: dailySeries,
    };
  }

  /**
   * Calculate performance metrics from activity records
   * Metrics:
   * - avgTypingIntensity: Average typing intensity (KPM) - summed from db, divided by active days
   * - avgMouseClickRate: Average mouse click rate (CPM) - summed from db, divided by active days
   * - avgCorrections: Correction rate % = (total_deletions / total_estimated_keystrokes) * 100
   *   where total_estimated_keystrokes = typing_intensity_kpm * (context_duration_minutes)
   * - dailyActiveAverage: (total context duration in hours) / number of active days
   */
  private calculateMetrics(activities: Activity[]) {
    if (activities.length === 0) {
      return {
        avgTypingIntensity: 0,
        avgMouseClickRate: 0,
        avgCorrections: 0,
        dailyActiveAverage: 0,
      };
    }

    let totalTypingIntensity = 0;
    let totalMouseClickRate = 0;
    let totalDeletionKeyPresses = 0;
    let totalEstimatedKeystrokes = 0;
    let totalDurationSeconds = 0;
    const activeDays = new Set<string>();

    for (const activity of activities) {
      const typingIntensity = activity.behavior?.typing_intensity_kpm || 0;
      totalTypingIntensity += typingIntensity;
      totalMouseClickRate += activity.behavior?.mouse_click_rate_cpm || 0;
      totalDeletionKeyPresses += activity.behavior?.total_deletion_key_presses || 0;
      activeDays.add(activity.date.toISOString().split('T')[0]);

      // Calculate context duration for this activity to estimate keystrokes
      let activityDurationSeconds = 0;
      if (activity.context) {
        const contextEntries = activity.context instanceof Map
          ? Array.from(activity.context.values())
          : Object.values(activity.context);

        for (const duration of contextEntries) {
          const durationSec = (duration as number) || 0;
          activityDurationSeconds += durationSec;
          totalDurationSeconds += durationSec;
        }
      }

      // Estimate keystrokes for this activity: KPM * (duration in minutes)
      const activityDurationMinutes = activityDurationSeconds / 60;
      const estimatedKeystrokes = typingIntensity * activityDurationMinutes;
      totalEstimatedKeystrokes += estimatedKeystrokes;
    }

    const totalDurationHours = totalDurationSeconds / 3600;
    const activeDaysCount = activeDays.size || 1;
    const dailyActiveAverage = totalDurationHours / activeDaysCount;

    const avgTypingIntensity = Math.round((totalTypingIntensity / activeDaysCount) * 10) / 10;
    const avgMouseClickRate = Math.round((totalMouseClickRate / activeDaysCount) * 10) / 10;

    // Correction rate: (total deletions / total estimated keystrokes) * 100
    const correctionRate =
      totalEstimatedKeystrokes > 0
        ? Math.round((totalDeletionKeyPresses / totalEstimatedKeystrokes) * 1000) / 10
        : 0;

    return {
      avgTypingIntensity,
      avgMouseClickRate,
      avgCorrections: correctionRate,
      dailyActiveAverage,
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
      dayMap.get(dateStr)!.push(activity);
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
      const { flow, debugging, research, communication, distracted } =
        this.categorizeActivities(dayActivities);

      result.push({
        date: dateStr,
        day_name: dayNames[date.getUTCDay()],
        flow_hours: Math.round(flow * 100) / 100,
        debugging_hours: Math.round(debugging * 100) / 100,
        research_hours: Math.round(research * 100) / 100,
        communication_hours: Math.round(communication * 100) / 100,
        distracted_hours: Math.round(distracted * 100) / 100,
      });
    }

    return result;
  }

  /**
   * Per-calendar-day aggregates of behavior fields (all projects combined).
   */
  private generateDailyBehaviorSeries(
    activities: Activity[],
    startDate: Date,
  ): DailyBehaviorMetricsDto[] {
    const dayMap = new Map<string, Activity[]>();
    for (const activity of activities) {
      const dateStr = activity.date.toISOString().split('T')[0];
      if (!dayMap.has(dateStr)) {
        dayMap.set(dateStr, []);
      }
      dayMap.get(dateStr)!.push(activity);
    }

    const result: DailyBehaviorMetricsDto[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setUTCDate(startDate.getUTCDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayActivities = dayMap.get(dateStr) || [];

      if (dayActivities.length === 0) {
        result.push({
          date: dateStr,
          day_name: dayNames[date.getUTCDay()],
          typing_intensity_kpm: 0,
          mouse_click_rate_cpm: 0,
          correction_rate_percent: 0,
          active_hours: 0,
          idle_hours: 0,
          total_deletion_key_presses: 0,
          total_mouse_movement_distance: 0,
        });
        continue;
      }

      let sumKpm = 0;
      let sumCpm = 0;
      let totalIdleSec = 0;
      let totalDel = 0;
      let totalMouse = 0;
      let totalCtxSec = 0;
      let totalEstKs = 0;

      for (const act of dayActivities) {
        const kpm = act.behavior?.typing_intensity_kpm || 0;
        const cpm = act.behavior?.mouse_click_rate_cpm || 0;
        sumKpm += kpm;
        sumCpm += cpm;
        totalIdleSec += act.behavior?.total_idle_sec || 0;
        totalDel += act.behavior?.total_deletion_key_presses || 0;
        totalMouse += act.behavior?.total_mouse_movement_distance || 0;

        let activityDurationSeconds = 0;
        if (act.context) {
          const vals =
            act.context instanceof Map
              ? Array.from(act.context.values())
              : Object.values(act.context);
          for (const duration of vals) {
            activityDurationSeconds += (duration as number) || 0;
          }
        }
        totalCtxSec += activityDurationSeconds;
        const activityDurationMinutes = activityDurationSeconds / 60;
        totalEstKs += kpm * activityDurationMinutes;
      }

      const n = dayActivities.length;
      const avgKpm = Math.round((sumKpm / n) * 100) / 100;
      const avgCpm = Math.round((sumCpm / n) * 100) / 100;
      const correction =
        totalEstKs > 0 ? Math.round((totalDel / totalEstKs) * 1000) / 10 : 0;
      const activeHours = Math.round((totalCtxSec / 3600) * 100) / 100;
      const idleHours = Math.round((totalIdleSec / 3600) * 100) / 100;

      result.push({
        date: dateStr,
        day_name: dayNames[date.getUTCDay()],
        typing_intensity_kpm: avgKpm,
        mouse_click_rate_cpm: avgCpm,
        correction_rate_percent: correction,
        active_hours: activeHours,
        idle_hours: idleHours,
        total_deletion_key_presses: totalDel,
        total_mouse_movement_distance: Math.round(totalMouse * 100) / 100,
      });
    }

    return result;
  }

  private categorizeActivities(
    activities: Activity[],
  ): {
    flow: number;
    debugging: number;
    research: number;
    communication: number;
    distracted: number;
  } {
    let flow = 0;
    let debugging = 0;
    let research = 0;
    let communication = 0;
    let distracted = 0;

    for (const activity of activities) {
      if (activity.context) {
        const contextEntries = activity.context instanceof Map
          ? Array.from(activity.context.entries())
          : Object.entries(activity.context);

        for (const [contextType, duration] of contextEntries) {
          const hours = ((duration as number) || 0) / 3600;
          const normalizedType = contextType.toUpperCase();

          switch (normalizedType) {
            case 'FLOW':
              flow += hours;
              break;
            case 'DEBUGGING':
              debugging += hours;
              break;
            case 'RESEARCH':
              research += hours;
              break;
            case 'COMMUNICATION':
              communication += hours;
              break;
            case 'DISTRACTED':
              distracted += hours;
              break;
          }
        }
      }
    }

    return { flow, debugging, research, communication, distracted };
  }

  /**
   * Get project insights: strongest skills (all-time) and current projects
   */
  async getProjectInsights(email: string): Promise<ProjectInsightsResponseDto> {
    // Verify user exists
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const userId = user._id;

    // Get all projects for this user
    const projects = await this.projectModel.find({ user_id: userId });

    // Calculate strongest skills (all-time cumulative)
    const skillMap = new Map<string, number>();

    for (const project of projects) {
      if (project.project_skills && Array.isArray(project.project_skills)) {
        for (const skill of project.project_skills) {
          const currentDuration = skillMap.get(skill.skill_name) || 0;
          skillMap.set(skill.skill_name, currentDuration + skill.duration_sec);
        }
      }
    }

    const totalDurationSec = Array.from(skillMap.values()).reduce((sum, duration) => sum + duration, 0);

    const strongestSkills = Array.from(skillMap.entries())
      .map(([name, durationSec]) => ({
        name,
        percent: totalDurationSec > 0 ? Math.round((durationSec / totalDurationSec) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 5);

    // Get current projects sorted by last_active_at (most recent first)
    const currentProjects = projects
      .filter(p => p.last_active_at) // Only include projects with last_active_at
      .sort((a, b) => {
        const dateA = new Date(a.last_active_at!).getTime();
        const dateB = new Date(b.last_active_at!).getTime();
        return dateB - dateA; // Descending order (most recent first)
      })
      .map(p => ({
        name: p.project_name,
        last_active: p.last_active_at!,
      }));

    return {
      strongest_skills: strongestSkills,
      current_projects: currentProjects,
    };
  }
}
