import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../user/schemas/user.schema';
import { ChatReport } from '../chat/schemas/chat-report.schema';

@Injectable()
export class AdminStatsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(ChatReport.name) private readonly chatReportModel: Model<ChatReport>,
  ) {}

  async getStats() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const isoHour = oneHourAgo.toISOString();

    const [
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      newUsersLast7Days,
      openChatReports,
      usersActiveDesktopLastHour,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ isVerified: true }),
      this.userModel.countDocuments({ isVerified: false }),
      this.userModel.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      this.chatReportModel.countDocuments({ status: 'open' }),
      this.userModel.countDocuments({
        activity_sync_at: { $gte: isoHour },
      }),
    ]);

    return {
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      usersActiveDesktopLastHour,
      newUsersLast7Days,
      openChatReports,
    };
  }
}
