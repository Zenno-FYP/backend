import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../user/schemas/user.schema';
import { Activity } from '../activity/schemas/activity.schema';
import { Project } from '../activity/schemas/project.schema';
import { NotificationPreferences } from './schemas/notification-preferences.schema';
import { NotificationService } from './notification.service';

interface RankedItem {
  name: string;
  seconds: number;
  share: number;
}

@Injectable()
export class DigestSchedulerService {
  private readonly logger = new Logger(DigestSchedulerService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Activity.name) private activityModel: Model<Activity>,
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(NotificationPreferences.name) private prefsModel: Model<NotificationPreferences>,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async processHourlyDigests() {
    this.logger.log('Digest scheduler tick');

    const eligiblePrefs = await this.prefsModel.find({ daily_digest_enabled: true }).lean();
    if (!eligiblePrefs.length) return;

    const userIds = eligiblePrefs.map((p) => p.user_id);
    const users = await this.userModel.find({ _id: { $in: userIds } }).lean();

    const nowUtc = new Date();

    for (const user of users) {
      try {
        const offsetHours = user.timezone_offset ?? 0;
        const localHour = (nowUtc.getUTCHours() + Math.round(offsetHours) + 24) % 24;

        if (localHour !== 20) continue; // Only fire at 8 PM local

        const localNow = new Date(nowUtc.getTime() + offsetHours * 3600000);
        const localDateStr = localNow.toISOString().slice(0, 10);

        const pref = eligiblePrefs.find(
          (p) => p.user_id.toString() === user._id.toString(),
        );
        if (pref?.last_digest_date === localDateStr) continue; // Already sent

        const userId = user._id as Types.ObjectId;
        const todayStart = new Date(localDateStr + 'T00:00:00Z');
        const todayEnd = new Date(localDateStr + 'T23:59:59.999Z');
        const yesterdayStart = new Date(todayStart.getTime() - 86400000);

        const todayActivities = await this.activityModel
          .find({ user_id: userId, date: { $gte: todayStart, $lte: todayEnd } })
          .lean();

        if (!todayActivities.length) continue;

        const yesterdayActivities = await this.activityModel
          .find({
            user_id: userId,
            date: { $gte: yesterdayStart, $lt: todayStart },
          })
          .lean();

        const todayApps = this.aggregateMap(todayActivities, 'apps');
        const todayLangs = this.aggregateMap(todayActivities, 'languages');
        const todayCtx = this.aggregateMap(todayActivities, 'context');

        const yesterdayApps = this.aggregateMap(yesterdayActivities, 'apps');
        const yesterdayLangs = this.aggregateMap(yesterdayActivities, 'languages');

        const topCtx = this.rank(todayCtx)[0];
        const todayTopApp = this.rank(todayApps)[0];
        const todayTopLang = this.rank(todayLangs)[0];
        const yesterdayTopApp = this.rank(yesterdayApps)[0];
        const yesterdayTopLang = this.rank(yesterdayLangs)[0];

        const projects = await this.projectModel.find({ user_id: userId }).lean();
        const todayTopSkill = this.getTopSkill(projects);

        const lines: string[] = [];
        if (topCtx) {
          lines.push(`Top context: ${topCtx.name} (${Math.round(topCtx.share)}%)`);
        }

        if (todayTopApp && this.isSignificantChange(todayTopApp, yesterdayTopApp)) {
          lines.push(`Top app change: ${todayTopApp.name} (${Math.round(todayTopApp.share)}%)`);
        }
        if (todayTopLang && this.isSignificantChange(todayTopLang, yesterdayTopLang)) {
          lines.push(`Top language change: ${todayTopLang.name} (${Math.round(todayTopLang.share)}%)`);
        }
        if (todayTopSkill) {
          lines.push(`Top skill: ${todayTopSkill}`);
        }

        const body = lines.join(' | ') || 'Keep up the great work!';

        await this.notificationService.createDigestNotification(userId, {
          title: 'Your Daily Digest',
          body,
          digestDate: localDateStr,
        });

        await this.prefsModel.updateOne(
          { user_id: userId },
          { $set: { last_digest_date: localDateStr } },
        );

        this.logger.log(`Digest sent for user ${userId.toString()}`);
      } catch (err) {
        this.logger.warn(`Digest failed for user ${user._id}: ${err}`);
      }
    }
  }

  private aggregateMap(
    activities: any[],
    field: 'apps' | 'languages' | 'context',
  ): Map<string, number> {
    const result = new Map<string, number>();
    for (const a of activities) {
      const map = a[field];
      if (!map) continue;
      const entries =
        map instanceof Map ? Array.from(map.entries()) : Object.entries(map);
      for (const [key, val] of entries) {
        result.set(key, (result.get(key) ?? 0) + (val as number));
      }
    }
    return result;
  }

  private rank(map: Map<string, number>): RankedItem[] {
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    if (!total) return [];
    return Array.from(map.entries())
      .map(([name, seconds]) => ({ name, seconds, share: (seconds / total) * 100 }))
      .sort((a, b) => b.seconds - a.seconds);
  }

  private isSignificantChange(
    today: RankedItem | undefined,
    yesterday: RankedItem | undefined,
  ): boolean {
    if (!today) return false;
    if (!yesterday) return true;
    if (today.name !== yesterday.name) return true;
    return Math.abs(today.share - yesterday.share) > 20;
  }

  private getTopSkill(projects: any[]): string | null {
    const skillMap = new Map<string, number>();
    for (const p of projects) {
      for (const s of p.project_skills ?? []) {
        skillMap.set(s.skill_name, (skillMap.get(s.skill_name) ?? 0) + s.duration_sec);
      }
    }
    if (!skillMap.size) return null;
    let topName = '';
    let topVal = 0;
    skillMap.forEach((val, name) => {
      if (val > topVal) {
        topVal = val;
        topName = name;
      }
    });
    return topName || null;
  }
}
