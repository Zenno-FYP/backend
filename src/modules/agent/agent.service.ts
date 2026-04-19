import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AgentPreferences } from './schemas/agent-preferences.schema';
import { NudgeRecord } from './schemas/nudge-record.schema';
import { UpdateAgentPreferencesDto } from './dto/update-agent-preferences.dto';
import { NudgeRecordItemDto } from './dto/sync-nudges.dto';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @InjectModel(AgentPreferences.name)
    private readonly prefsModel: Model<AgentPreferences>,
    @InjectModel(NudgeRecord.name)
    private readonly nudgeModel: Model<NudgeRecord>,
  ) {}

  // ── Preferences ────────────────────────────────────────────────────────────

  async getPreferences(userId: string): Promise<AgentPreferences> {
    const existing = await this.prefsModel.findOne({ user_id: userId }).lean();
    if (existing) return existing as AgentPreferences;

    // First call — create with defaults.
    const created = await this.prefsModel.create({ user_id: userId });
    return created.toObject() as AgentPreferences;
  }

  async updatePreferences(
    userId: string,
    dto: UpdateAgentPreferencesDto,
  ): Promise<AgentPreferences> {
    const updated = await this.prefsModel
      .findOneAndUpdate(
        { user_id: userId },
        { $set: dto },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .lean();
    return updated as AgentPreferences;
  }

  // ── Nudge stats ────────────────────────────────────────────────────────────

  async getNudgeStats(userId: string): Promise<{
    total_nudges: number;
    today_nudges: number;
    this_week_nudges: number;
    total_suppressed: number;
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const [total, today, thisWeek, suppressed] = await Promise.all([
      this.nudgeModel.countDocuments({ user_id: userId, was_suppressed: false }),
      this.nudgeModel.countDocuments({
        user_id: userId,
        was_suppressed: false,
        generated_at: { $gte: todayStart },
      }),
      this.nudgeModel.countDocuments({
        user_id: userId,
        was_suppressed: false,
        generated_at: { $gte: weekStart },
      }),
      this.nudgeModel.countDocuments({ user_id: userId, was_suppressed: true }),
    ]);

    return {
      total_nudges: total,
      today_nudges: today,
      this_week_nudges: thisWeek,
      total_suppressed: suppressed,
    };
  }

  // ── Nudge sync (from desktop agent) ───────────────────────────────────────

  async syncNudges(
    userId: string,
    records: NudgeRecordItemDto[],
  ): Promise<{ synced: number; skipped: number }> {
    if (!records.length) return { synced: 0, skipped: 0 };

    let synced = 0;
    let skipped = 0;

    const ops = records.map((r) => ({
      updateOne: {
        filter: { user_id: userId, generated_at: new Date(r.generated_at) },
        update: {
          $setOnInsert: {
            user_id: userId,
            generated_at: new Date(r.generated_at),
            nudge_type: r.nudge_type,
            nudge_text: r.nudge_text ?? '',
            was_suppressed: r.was_suppressed ?? false,
          },
        },
        upsert: true,
      },
    }));

    const result = await this.nudgeModel.bulkWrite(ops, { ordered: false });
    synced = result.upsertedCount;
    skipped = records.length - synced;

    this.logger.log(
      `[AgentService] syncNudges user=${userId} synced=${synced} skipped=${skipped}`,
    );
    return { synced, skipped };
  }
}
