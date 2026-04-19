import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification } from './schemas/notification.schema';
import { NotificationDevice } from './schemas/notification-device.schema';
import { NotificationPreferences } from './schemas/notification-preferences.schema';
import { FirebaseService } from '../../firebase/firebase.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(Notification.name) private notifModel: Model<Notification>,
    @InjectModel(NotificationDevice.name) private deviceModel: Model<NotificationDevice>,
    @InjectModel(NotificationPreferences.name) private prefsModel: Model<NotificationPreferences>,
    private readonly firebaseService: FirebaseService,
  ) {}

  // ─── Internal producers ────────────────────────────────────────────

  async createChatNotification(
    recipientUserId: string,
    senderName: string,
    preview: string,
    conversationId: string,
    senderUserId?: string,
  ) {
    const userId = new Types.ObjectId(recipientUserId);
    const prefs = await this.getOrCreatePrefs(userId);
    if (!prefs.chat_enabled) return;

    const dataEntries: Array<[string, string]> = [
      ['type', 'chat_message'],
      ['conversationId', conversationId],
      ['senderName', senderName],
    ];
    if (senderUserId) {
      dataEntries.push(['senderUserId', senderUserId]);
    }

    const notif = await this.notifModel.create({
      user_id: userId,
      type: 'chat_message',
      title: `New message from ${senderName}`,
      body: preview,
      data: new Map<string, string>(dataEntries),
    });

    // Pass prefs through so sendPush doesn't fetch them again.
    await this.sendPush(userId, notif, prefs);
  }

  async createNewProjectNotification(userId: string, projectName: string) {
    const uid = new Types.ObjectId(userId);
    const prefs = await this.getOrCreatePrefs(uid);
    if (!prefs.new_project_enabled) return;

    const dedupeKey = `new_project:${userId}:${projectName}`;

    try {
      const notif = await this.notifModel.create({
        user_id: uid,
        type: 'new_project',
        title: 'New project detected',
        body: `"${projectName}" has been added to your workspace.`,
        data: new Map<string, string>([
          ['type', 'new_project'],
          ['projectName', projectName],
        ]),
        dedupe_key: dedupeKey,
      });

      await this.sendPush(uid, notif, prefs);
    } catch (err: any) {
      if (err?.code === 11000) return; // duplicate key — already sent
      throw err;
    }
  }

  async createDigestNotification(
    userId: Types.ObjectId,
    digestPayload: { title: string; body: string; digestDate: string },
  ) {
    const prefs = await this.getOrCreatePrefs(userId);
    if (!prefs.daily_digest_enabled) return;

    const dedupeKey = `digest:${userId.toString()}:${digestPayload.digestDate}`;

    try {
      const notif = await this.notifModel.create({
        user_id: userId,
        type: 'daily_digest',
        title: digestPayload.title,
        body: digestPayload.body,
        data: new Map<string, string>([
          ['type', 'daily_digest'],
          ['digestDate', digestPayload.digestDate],
        ]),
        dedupe_key: dedupeKey,
      });

      await this.sendPush(userId, notif, prefs);
    } catch (err: any) {
      if (err?.code === 11000) return;
      throw err;
    }
  }

  // ─── Controller-facing methods ─────────────────────────────────────

  async listNotifications(userId: Types.ObjectId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, unreadCount] = await Promise.all([
      this.notifModel
        .find({ user_id: userId })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit + 1)
        .lean(),
      this.notifModel.countDocuments({ user_id: userId, read_at: null }),
    ]);

    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    return { items, unreadCount, hasMore };
  }

  async getUnreadCount(userId: Types.ObjectId): Promise<number> {
    return this.notifModel.countDocuments({ user_id: userId, read_at: null });
  }

  async markRead(userId: Types.ObjectId, notifId: string) {
    await this.notifModel.updateOne(
      { _id: new Types.ObjectId(notifId), user_id: userId },
      { $set: { read_at: new Date() } },
    );
  }

  async markAllRead(userId: Types.ObjectId) {
    await this.notifModel.updateMany(
      { user_id: userId, read_at: null },
      { $set: { read_at: new Date() } },
    );
  }

  async registerDevice(
    userId: Types.ObjectId,
    token: string,
    platform: 'web' | 'android',
    deviceLabel: string,
  ) {
    await this.deviceModel.findOneAndUpdate(
      { fcm_token: token },
      {
        $set: {
          user_id: userId,
          platform,
          device_label: deviceLabel,
          push_enabled: true,
          last_seen_at: new Date(),
        },
      },
      { upsert: true },
    );
  }

  async unregisterDevice(userId: Types.ObjectId, token: string) {
    await this.deviceModel.deleteOne({ user_id: userId, fcm_token: token });
  }

  async getPreferences(userId: Types.ObjectId) {
    return this.getOrCreatePrefs(userId);
  }

  async updatePreferences(
    userId: Types.ObjectId,
    partial: Partial<Pick<
      NotificationPreferences,
      'push_enabled' | 'chat_enabled' | 'new_project_enabled' | 'daily_digest_enabled'
    >>,
  ) {
    const prefs = await this.prefsModel.findOneAndUpdate(
      { user_id: userId },
      { $set: partial },
      { new: true, upsert: true },
    );
    return prefs;
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private async getOrCreatePrefs(userId: Types.ObjectId) {
    let prefs = await this.prefsModel.findOne({ user_id: userId });
    if (!prefs) {
      prefs = await this.prefsModel.create({ user_id: userId });
    }
    return prefs;
  }

  /**
   * Push the given notification to every active device the user has.
   *
   * The producer (createChat / createNewProject / createDigest) has already
   * fetched the user's preferences to gate the *type-specific* flag
   * (chat_enabled, new_project_enabled, daily_digest_enabled). We accept the
   * same `prefs` here as an optional argument so we don't run a second
   * `findOne` per notification just to read `push_enabled`. If a caller
   * doesn't pass it (e.g. an internal admin push) we lazily fetch.
   */
  private async sendPush(
    userId: Types.ObjectId,
    notif: Notification,
    prefs?: NotificationPreferences,
  ) {
    const resolvedPrefs = prefs ?? (await this.getOrCreatePrefs(userId));
    if (!resolvedPrefs.push_enabled) return;

    const devices = await this.deviceModel.find({
      user_id: userId,
      push_enabled: true,
    });

    const tokens = devices.map((d) => d.fcm_token);
    if (!tokens.length) return;

    const dataPayload: Record<string, string> = { notificationId: notif._id.toString() };
    if (notif.data) {
      notif.data.forEach((value, key) => {
        dataPayload[key] = value;
      });
    }

    const result = await this.firebaseService.sendMulticastPush(
      tokens,
      { title: notif.title, body: notif.body },
      dataPayload,
    );

    if (result.failedTokens.length) {
      await this.deviceModel.deleteMany({
        fcm_token: { $in: result.failedTokens },
      });
      this.logger.log(`Purged ${result.failedTokens.length} stale FCM tokens`);
    }

    if (result.successCount > 0) {
      await this.notifModel.updateOne(
        { _id: notif._id },
        { $set: { push_sent_at: new Date() } },
      );
    }
  }
}
