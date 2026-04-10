import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PublicProfileResponseDto } from './dto/public-profile.dto';
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
import { SkillsProjectsDetailResponseDto } from './dto/skills-projects-detail.dto';
import { ProjectDetailResponseDto, UpdateProjectDto } from './dto/project-detail.dto';
import { ProfilePageResponseDto, ProfileProjectInsightDto } from './dto/profile-page.dto';

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
          const hours = this.coerceSeconds(duration) / 3600;
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

  /** UTC calendar day key, consistent with usage trend grouping. */
  private activityDayKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private prevUtcDayKey(ymd: string): string {
    const d = new Date(`${ymd}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().split('T')[0];
  }

  /**
   * Days in a row ending at today or yesterday (if today has no sync yet) with ≥1 activity document.
   */
  private computeActivityStreak(activities: Activity[]): number {
    const days = new Set<string>();
    for (const a of activities) {
      if (a.date) {
        days.add(this.activityDayKey(a.date as Date));
      }
    }
    if (days.size === 0) {
      return 0;
    }
    const todayStr = this.activityDayKey(new Date());
    let cursor = todayStr;
    if (!days.has(cursor)) {
      cursor = this.prevUtcDayKey(todayStr);
    }
    let streak = 0;
    while (days.has(cursor)) {
      streak += 1;
      cursor = this.prevUtcDayKey(cursor);
    }
    return streak;
  }

  private aggregateGlobalAppSeconds(activities: Activity[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const activity of activities) {
      if (!activity.apps) {
        continue;
      }
      const apps =
        activity.apps instanceof Map ? activity.apps : new Map(Object.entries(activity.apps || {}));
      for (const [name, sec] of apps) {
        const key = (name || '').trim() || 'Unknown';
        map.set(key, (map.get(key) || 0) + this.coerceSeconds(sec));
      }
    }
    return map;
  }

  private buildProjectProfileInsight(activities: Activity[]): ProfileProjectInsightDto {
    const cb = this.projectContextBreakdownHours(activities);
    const parts: { label: string; h: number }[] = [
      { label: 'Flow', h: cb.flow_hours },
      { label: 'Debugging', h: cb.debugging_hours },
      { label: 'Research', h: cb.research_hours },
      { label: 'Communication', h: cb.communication_hours },
      { label: 'Distracted', h: cb.distracted_hours },
      { label: 'Other', h: cb.other_hours },
    ];
    const total = parts.reduce((s, p) => s + p.h, 0);
    if (total < 0.05) {
      return { kind: 'none' };
    }
    const flowRatio = cb.flow_hours / total;
    if (total >= 0.25) {
      return {
        kind: 'flow_focus',
        flow_focus_percent: Math.round((flowRatio * 100 + Number.EPSILON) * 10) / 10,
      };
    }
    const top = parts.reduce((a, b) => (b.h > a.h ? b : a));
    return {
      kind: 'dominant_context',
      label: top.label,
      percent: Math.round(((top.h / total) * 100 + Number.EPSILON) * 10) / 10,
    };
  }

  private static readonly PROFILE_GLOBAL_LIST_LIMIT = 8;
  /** Matches website ProfilePage MAX_GLOBAL_VISIBLE for public view. */
  private static readonly PUBLIC_PROFILE_GLOBAL_VISIBLE = 6;

  private mergeProjectOrderForProfile(savedOrder: string[], projectNames: string[]): string[] {
    const set = new Set(projectNames);
    const ordered = savedOrder.filter((n) => set.has(n));
    for (const n of projectNames) {
      if (!ordered.includes(n)) {
        ordered.push(n);
      }
    }
    return ordered;
  }

  /**
   * Raw profile analytics (owner sees everything; filtering is client-side or via {@link applyOwnerPreferencesToProfilePage}).
   */
  private computeProfilePage(projects: Project[], activities: Activity[]): ProfilePageResponseDto {
    const streak = this.computeActivityStreak(activities);
    const appSecByProject = this.aggregateAppSecondsByProject(activities);
    const totalAppSec = Array.from(appSecByProject.values()).reduce((a, b) => a + b, 0);

    const globalAppsMap = this.aggregateGlobalAppSeconds(activities);
    const totalGlobalAppSec = Array.from(globalAppsMap.values()).reduce((a, b) => a + b, 0);
    const top_apps_global = this.rowsFromSecondsMap(
      globalAppsMap,
      totalGlobalAppSec,
      DashboardService.PROFILE_GLOBAL_LIST_LIMIT,
    );

    const skillMap = new Map<string, number>();
    for (const project of projects) {
      if (project.project_skills && Array.isArray(project.project_skills)) {
        for (const skill of project.project_skills) {
          const n = (skill.skill_name || '').trim();
          if (!n) {
            continue;
          }
          skillMap.set(n, (skillMap.get(n) || 0) + this.coerceSeconds(skill.duration_sec));
        }
      }
    }
    const totalSkillSec = Array.from(skillMap.values()).reduce((a, b) => a + b, 0);
    const top_skills_global = Array.from(skillMap.entries())
      .filter(([, sec]) => sec > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, DashboardService.PROFILE_GLOBAL_LIST_LIMIT)
      .map(([name, sec]) => ({
        name,
        duration_hours: Math.round((sec / 3600) * 100) / 100,
        percent:
          totalSkillSec > 0
            ? Math.round(((sec / totalSkillSec) * 100 + Number.EPSILON) * 10) / 10
            : 0,
      }));

    const langLines = new Map<string, number>();
    let totalLinesAll = 0;
    for (const p of projects) {
      for (const loc of p.current_loc || []) {
        const lang = loc.language || 'Unknown';
        const lines = loc.lines || 0;
        langLines.set(lang, (langLines.get(lang) || 0) + lines);
        totalLinesAll += lines;
      }
    }
    const top_languages_global = Array.from(langLines.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, DashboardService.PROFILE_GLOBAL_LIST_LIMIT)
      .map(([name, lines]) => ({
        name,
        lines,
        percent:
          totalLinesAll > 0
            ? Math.round(((lines / totalLinesAll) * 100 + Number.EPSILON) * 10) / 10
            : 0,
      }));

    const cat = this.categorizeActivities(activities);
    const ctxHours = cat.flow + cat.debugging + cat.research + cat.communication + cat.distracted;
    const global_flow_focus_percent =
      ctxHours >= 0.25
        ? Math.round(((cat.flow / ctxHours) * 100 + Number.EPSILON) * 10) / 10
        : null;

    const actsByProject = new Map<string, Activity[]>();
    for (const a of activities) {
      const pn = a.project_name;
      if (!actsByProject.has(pn)) {
        actsByProject.set(pn, []);
      }
      actsByProject.get(pn)!.push(a);
    }

    const projectCards = projects.map((p) => {
      const pn = p.project_name;
      const projActs = actsByProject.get(pn) || [];
      const appSec = appSecByProject.get(pn) || 0;

      const appMap = new Map<string, number>();
      for (const act of projActs) {
        if (!act.apps) {
          continue;
        }
        const apps =
          act.apps instanceof Map ? act.apps : new Map(Object.entries(act.apps || {}));
        for (const [name, sec] of apps) {
          const key = (name || '').trim() || 'Unknown';
          appMap.set(key, (appMap.get(key) || 0) + this.coerceSeconds(sec));
        }
      }
      const totalPApp = Array.from(appMap.values()).reduce((a, b) => a + b, 0);
      const top_apps_p = this.rowsFromSecondsMap(appMap, totalPApp, 4);

      const skillRowsFull = this.buildProjectSkillRows(p.project_skills);
      const totalSkillProj = skillRowsFull.reduce((s, r) => s + r.duration_sec, 0);
      const top_skills_p = skillRowsFull.slice(0, 4).map((r) => ({
        name: r.name,
        duration_sec: r.duration_sec,
        duration_hours: Math.round(r.duration_hours * 100) / 100,
        percent:
          totalSkillProj > 0
            ? Math.round(((r.duration_sec / totalSkillProj) * 100 + Number.EPSILON) * 10) / 10
            : 0,
      }));

      let totalPLines = 0;
      const langMap = new Map<string, number>();
      for (const loc of p.current_loc || []) {
        totalPLines += loc.lines || 0;
        const lang = loc.language || 'Unknown';
        langMap.set(lang, (langMap.get(lang) || 0) + (loc.lines || 0));
      }
      const languages = Array.from(langMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, lines]) => ({
          name,
          percent:
            totalPLines > 0
              ? Math.round(((lines / totalPLines) * 100 + Number.EPSILON) * 10) / 10
              : 0,
        }));

      const insight = this.buildProjectProfileInsight(projActs);

      return {
        project_name: pn,
        display_name: p.display_name ?? null,
        description: p.description ?? '',
        last_active: p.last_active_at ?? null,
        app_time_hours: Math.round((appSec / 3600) * 100) / 100,
        languages,
        top_apps: top_apps_p,
        top_skills: top_skills_p,
        insight,
      };
    });

    projectCards.sort((a, b) => {
      if (!a.last_active && !b.last_active) {
        return a.project_name.localeCompare(b.project_name);
      }
      if (!a.last_active) {
        return 1;
      }
      if (!b.last_active) {
        return -1;
      }
      return new Date(b.last_active).getTime() - new Date(a.last_active).getTime();
    });

    return {
      streak_days: streak,
      total_app_time_hours: Math.round((totalAppSec / 3600) * 100) / 100,
      total_projects: projects.length,
      global_flow_focus_percent,
      top_skills: top_skills_global,
      top_apps: top_apps_global,
      top_languages: top_languages_global,
      projects: projectCards,
    };
  }

  /**
   * Profile shown to other users: same analytics shape as the owner, filtered by the owner's profile_preferences.
   */
  private applyOwnerPreferencesToProfilePage(
    page: ProfilePageResponseDto,
    prefs: User['profile_preferences'] | undefined,
    allActivities: Activity[],
  ): ProfilePageResponseDto {
    const p = prefs ?? {
      hidden_project_names: [],
      project_order: [],
      hidden_skill_names: [],
      hidden_app_names: [],
      hidden_language_names: [],
    };
    const hiddenP = new Set(p.hidden_project_names ?? []);
    const hiddenS = new Set(p.hidden_skill_names ?? []);
    const hiddenA = new Set(p.hidden_app_names ?? []);
    const hiddenL = new Set(p.hidden_language_names ?? []);

    const fullOrder = this.mergeProjectOrderForProfile(
      p.project_order ?? [],
      page.projects.map((c) => c.project_name),
    );
    const cardByName = new Map(page.projects.map((c) => [c.project_name, c]));
    const orderedVisible = fullOrder
      .filter((pn) => !hiddenP.has(pn))
      .map((pn) => cardByName.get(pn))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    const visibleNames = new Set(orderedVisible.map((c) => c.project_name));
    const filteredActs = allActivities.filter((a) => visibleNames.has(a.project_name));

    const streak = this.computeActivityStreak(filteredActs);
    const cat = this.categorizeActivities(filteredActs);
    const ctxHours = cat.flow + cat.debugging + cat.research + cat.communication + cat.distracted;
    const global_flow_focus_percent =
      ctxHours >= 0.25
        ? Math.round(((cat.flow / ctxHours) * 100 + Number.EPSILON) * 10) / 10
        : null;

    const totalAppHours = orderedVisible.reduce((s, c) => s + c.app_time_hours, 0);

    const lim = DashboardService.PUBLIC_PROFILE_GLOBAL_VISIBLE;
    const top_skills = page.top_skills.filter((s) => !hiddenS.has(s.name)).slice(0, lim);
    const top_apps = page.top_apps.filter((a) => !hiddenA.has(a.name)).slice(0, lim);
    const top_languages = page.top_languages.filter((l) => !hiddenL.has(l.name)).slice(0, lim);

    return {
      ...page,
      streak_days: streak,
      total_projects: orderedVisible.length,
      total_app_time_hours: Math.round(totalAppHours * 100) / 100,
      global_flow_focus_percent,
      top_skills,
      top_apps,
      top_languages,
      projects: orderedVisible,
    };
  }

  /**
   * Profile dashboard payload: streak, global top lists, per-project cards.
   */
  async getProfilePage(email: string): Promise<ProfilePageResponseDto> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const [projects, activities] = await Promise.all([
      this.projectModel.find({ user_id: user._id }),
      this.activityModel.find({ user_id: user._id }),
    ]);
    return this.computeProfilePage(projects, activities);
  }

  async getPublicProfileByUserId(viewerEmail: string, targetUserId: string): Promise<PublicProfileResponseDto> {
    if (!Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestException('Invalid user id');
    }
    const viewer = await this.userModel.findOne({ email: viewerEmail });
    if (!viewer) {
      throw new BadRequestException('User not found');
    }
    const target = await this.userModel.findById(targetUserId);
    if (!target) {
      throw new NotFoundException('Profile not found');
    }
    const [projects, activities] = await Promise.all([
      this.projectModel.find({ user_id: target._id }),
      this.activityModel.find({ user_id: target._id }),
    ]);
    const raw = this.computeProfilePage(projects, activities);
    const profile = this.applyOwnerPreferencesToProfilePage(raw, target.profile_preferences, activities);
    const created = target.createdAt;
    return {
      user: {
        name: target.name,
        profilePhoto: target.profilePhoto ?? null,
        description: target.description ?? '',
        github_url: target.github_url ?? null,
        linkedin_url: target.linkedin_url ?? null,
        twitter_url: target.twitter_url ?? null,
        createdAt: created instanceof Date ? created.toISOString() : created ? String(created) : null,
      },
      profile,
    };
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
      .map((p) => ({
        name: p.project_name,
        display_name: p.display_name ?? null,
        last_active: p.last_active_at!,
      }));

    return {
      strongest_skills: strongestSkills,
      current_projects: currentProjects,
    };
  }

  /** Normalize duration values from Mongo / sync (handles Decimal128-like objects). */
  private coerceSeconds(value: unknown): number {
    if (value == null || value === '') {
      return 0;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'object' && value !== null && 'toString' in value) {
      const n = Number(String(value));
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Sum activity.apps durations (seconds) per project_name.
   */
  private aggregateAppSecondsByProject(activities: Activity[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const activity of activities) {
      if (!activity.apps) {
        continue;
      }
      const pn = activity.project_name;
      const apps =
        activity.apps instanceof Map ? activity.apps : new Map(Object.entries(activity.apps || {}));
      let daySec = 0;
      for (const [, sec] of apps) {
        daySec += this.coerceSeconds(sec);
      }
      map.set(pn, (map.get(pn) || 0) + daySec);
    }
    return map;
  }

  /**
   * Sorted rows (hours + percent of totalSec) from per-label second totals.
   */
  private rowsFromSecondsMap(
    totals: Map<string, number>,
    totalSec: number,
    limit: number,
  ): { name: string; duration_hours: number; percent: number }[] {
    if (totalSec <= 0) {
      return [];
    }
    return Array.from(totals.entries())
      .filter(([, sec]) => this.coerceSeconds(sec) > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, sec]) => {
        const s = this.coerceSeconds(sec);
        return {
          name,
          duration_hours: Math.round((s / 3600) * 100) / 100,
          percent:
            Math.round(((s / totalSec) * 100 + Number.EPSILON) * 10) / 10,
        };
      });
  }

  private projectContextBreakdownHours(activities: Activity[]): {
    flow_hours: number;
    debugging_hours: number;
    research_hours: number;
    communication_hours: number;
    distracted_hours: number;
    other_hours: number;
  } {
    const c = this.categorizeActivities(activities);
    let totalContextSec = 0;
    for (const act of activities) {
      if (!act.context) {
        continue;
      }
      const vals =
        act.context instanceof Map
          ? Array.from(act.context.values())
          : Object.values(act.context);
      for (const dur of vals) {
        totalContextSec += this.coerceSeconds(dur);
      }
    }
    const knownHours = c.flow + c.debugging + c.research + c.communication + c.distracted;
    const knownSec = knownHours * 3600;
    const otherSec = Math.max(0, totalContextSec - knownSec);
    const r = (n: number) => Math.round(n * 100) / 100;

    return {
      flow_hours: r(c.flow),
      debugging_hours: r(c.debugging),
      research_hours: r(c.research),
      communication_hours: r(c.communication),
      distracted_hours: r(c.distracted),
      other_hours: r(otherSec / 3600),
    };
  }

  /**
   * Merge project_skills by trimmed name (avoids duplicates / casing drift) and keep any skill with > 0 sec.
   */
  private buildProjectSkillRows(
    projectSkills: { skill_name?: string; duration_sec?: number }[] | undefined,
  ): { name: string; duration_sec: number; duration_hours: number }[] {
    const merged = new Map<string, number>();
    for (const s of projectSkills || []) {
      const name = (s.skill_name || '').trim();
      if (!name) {
        continue;
      }
      merged.set(name, (merged.get(name) || 0) + this.coerceSeconds(s.duration_sec));
    }
    return Array.from(merged.entries())
      .filter(([, sec]) => sec > 0)
      .map(([name, duration_sec]) => ({
        name,
        duration_sec,
        duration_hours: Math.round((duration_sec / 3600) * 10000) / 10000,
      }))
      .sort((a, b) => b.duration_sec - a.duration_sec);
  }

  /**
   * Typing / mouse averages weighted by context duration per day (falls back to equal weight if no context).
   */
  private aggregateProjectBehavior(activities: Activity[]): {
    avg_typing_kpm: number;
    avg_mouse_cpm: number;
    total_idle_hours: number;
  } {
    let wTyping = 0;
    let wMouse = 0;
    let weight = 0;
    let totalIdleSec = 0;

    for (const act of activities) {
      totalIdleSec += this.coerceSeconds(act.behavior?.total_idle_sec);

      let dayCtxSec = 0;
      if (act.context) {
        const vals =
          act.context instanceof Map
            ? Array.from(act.context.values())
            : Object.values(act.context);
        for (const d of vals) {
          dayCtxSec += this.coerceSeconds(d);
        }
      }
      const w = dayCtxSec > 0 ? dayCtxSec : 1;
      weight += w;
      wTyping += (act.behavior?.typing_intensity_kpm || 0) * w;
      wMouse += (act.behavior?.mouse_click_rate_cpm || 0) * w;
    }

    const r = (n: number) => Math.round(n * 100) / 100;
    return {
      avg_typing_kpm: weight > 0 ? r(wTyping / weight) : 0,
      avg_mouse_cpm: weight > 0 ? r(wMouse / weight) : 0,
      total_idle_hours: r(totalIdleSec / 3600),
    };
  }

  /**
   * Skills & projects overview: skills from project_skills; app time from activity.apps per project.
   */
  async getSkillsProjectsDetail(email: string): Promise<SkillsProjectsDetailResponseDto> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const userId = user._id;
    const [projects, activities] = await Promise.all([
      this.projectModel.find({ user_id: userId }),
      this.activityModel.find({ user_id: userId }),
    ]);

    const appSecByProject = this.aggregateAppSecondsByProject(activities);
    const totalAppSec = Array.from(appSecByProject.values()).reduce((a, b) => a + b, 0);

    const skillMap = new Map<string, number>();
    let totalLinesAll = 0;

    for (const project of projects) {
      if (project.project_skills && Array.isArray(project.project_skills)) {
        for (const skill of project.project_skills) {
          const sec = skill.duration_sec || 0;
          skillMap.set(skill.skill_name, (skillMap.get(skill.skill_name) || 0) + sec);
        }
      }
      if (project.current_loc && Array.isArray(project.current_loc)) {
        for (const loc of project.current_loc) {
          totalLinesAll += loc.lines || 0;
        }
      }
    }

    const totalSkillSec = Array.from(skillMap.values()).reduce((a, b) => a + b, 0);

    const skills = Array.from(skillMap.entries())
      .map(([name, sec]) => ({
        name,
        duration_hours: Math.round((sec / 3600) * 100) / 100,
        percent_of_total:
          totalSkillSec > 0
            ? Math.round(((sec / totalSkillSec) * 100 + Number.EPSILON) * 10) / 10
            : 0,
      }))
      .sort((a, b) => b.duration_hours - a.duration_hours);

    const projectItems = projects
      .map((p) => {
        let totalLines = 0;
        let totalFiles = 0;
        const langMap = new Map<string, number>();
        if (p.current_loc && Array.isArray(p.current_loc)) {
          for (const loc of p.current_loc) {
            totalLines += loc.lines || 0;
            totalFiles += loc.files || 0;
            const lang = loc.language || 'Unknown';
            langMap.set(lang, (langMap.get(lang) || 0) + (loc.lines || 0));
          }
        }

        const topLanguages = Array.from(langMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, lines]) => ({ name, lines }));

        const projSkills = this.buildProjectSkillRows(p.project_skills).map((row) => ({
          name: row.name,
          duration_sec: row.duration_sec,
          duration_hours: Math.round(row.duration_hours * 100) / 100,
        }));

        const appSec = appSecByProject.get(p.project_name) || 0;

        return {
          name: p.project_name,
          display_name: p.display_name ?? null,
          description: p.description ?? '',
          last_active: p.last_active_at ?? null,
          first_seen: p.first_seen_at ?? null,
          total_lines: totalLines,
          total_files: totalFiles,
          top_languages: topLanguages,
          skills: projSkills,
          app_time_hours: Math.round((appSec / 3600) * 100) / 100,
        };
      })
      .sort((a, b) => {
        if (!a.last_active && !b.last_active) {
          return a.name.localeCompare(b.name);
        }
        if (!a.last_active) {
          return 1;
        }
        if (!b.last_active) {
          return -1;
        }
        return new Date(b.last_active).getTime() - new Date(a.last_active).getTime();
      });

    return {
      summary: {
        total_projects: projects.length,
        total_app_time_hours: Math.round((totalAppSec / 3600) * 100) / 100,
        unique_skills_count: skillMap.size,
        total_lines_of_code: totalLinesAll,
      },
      skills,
      projects: projectItems,
    };
  }

  async getProjectDetail(email: string, projectName: string): Promise<ProjectDetailResponseDto> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const project = await this.projectModel.findOne({
      user_id: user._id,
      project_name: projectName,
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const activities = await this.activityModel.find({
      user_id: user._id,
      project_name: projectName,
    });

    let appSec = 0;
    const appAgg = new Map<string, number>();
    let langActSec = 0;
    const langAgg = new Map<string, number>();

    for (const act of activities) {
      if (act.apps) {
        const apps =
          act.apps instanceof Map ? act.apps : new Map(Object.entries(act.apps || {}));
        for (const [appName, sec] of apps) {
          const s = this.coerceSeconds(sec);
          const key = (appName || '').trim() || 'Unknown';
          appSec += s;
          appAgg.set(key, (appAgg.get(key) || 0) + s);
        }
      }
      if (act.languages) {
        const langs =
          act.languages instanceof Map
            ? act.languages
            : new Map(Object.entries(act.languages || {}));
        for (const [langName, sec] of langs) {
          const s = this.coerceSeconds(sec);
          const key = (langName || '').trim() || 'Unknown';
          langActSec += s;
          langAgg.set(key, (langAgg.get(key) || 0) + s);
        }
      }
    }

    const topApps = this.rowsFromSecondsMap(appAgg, appSec, 25);
    const languagesByActiveTime = this.rowsFromSecondsMap(langAgg, langActSec, 25);
    const contextBreakdown = this.projectContextBreakdownHours(activities);
    const behavior = this.aggregateProjectBehavior(activities);

    let totalLines = 0;
    let totalFiles = 0;
    const langLines = new Map<string, number>();
    if (project.current_loc && Array.isArray(project.current_loc)) {
      for (const loc of project.current_loc) {
        totalLines += loc.lines || 0;
        totalFiles += loc.files || 0;
        const lang = loc.language || 'Unknown';
        langLines.set(lang, (langLines.get(lang) || 0) + (loc.lines || 0));
      }
    }

    const languages = Array.from(langLines.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, lines]) => ({
        name,
        lines,
        percent:
          totalLines > 0
            ? Math.round(((lines / totalLines) * 100 + Number.EPSILON) * 10) / 10
            : 0,
      }));

    const skills = this.buildProjectSkillRows(project.project_skills);

    return {
      project_name: project.project_name,
      display_name: project.display_name ?? null,
      description: project.description ?? '',
      first_seen: project.first_seen_at ?? null,
      last_active: project.last_active_at ?? null,
      app_time_hours: Math.round((appSec / 3600) * 100) / 100,
      total_lines: totalLines,
      total_files: totalFiles,
      languages,
      top_apps: topApps,
      languages_by_active_time: languagesByActiveTime,
      context_breakdown: contextBreakdown,
      behavior,
      skills,
    };
  }

  async updateProject(
    email: string,
    projectName: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectDetailResponseDto> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const set: Record<string, unknown> = {};
    if (dto.display_name !== undefined) {
      const v = dto.display_name.trim();
      // Empty or identical to sync name → no separate display name stored (default = project_name).
      if (v.length === 0 || v === projectName) {
        set.display_name = null;
      } else {
        set.display_name = v.slice(0, 200);
      }
    }
    if (dto.description !== undefined) {
      set.description = dto.description.slice(0, 2000);
    }

    if (Object.keys(set).length === 0) {
      return this.getProjectDetail(email, projectName);
    }

    const result = await this.projectModel.updateOne(
      { user_id: user._id, project_name: projectName },
      { $set: set },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('Project not found');
    }

    return this.getProjectDetail(email, projectName);
  }

  /**
   * Deletes the project row and all daily Activity documents for this user + project_name.
   */
  async deleteProject(email: string, projectName: string): Promise<void> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const existing = await this.projectModel.findOne({
      user_id: user._id,
      project_name: projectName,
    });
    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    await this.activityModel.deleteMany({
      user_id: user._id,
      project_name: projectName,
    });
    await this.projectModel.deleteOne({
      user_id: user._id,
      project_name: projectName,
    });
  }
}
