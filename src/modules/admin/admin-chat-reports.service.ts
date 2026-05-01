import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../user/schemas/user.schema';
import { Conversation } from '../chat/schemas/conversation.schema';
import { ChatMessage } from '../chat/schemas/chat-message.schema';
import { ChatReport, ChatReportStatus } from '../chat/schemas/chat-report.schema';

const MESSAGE_PREVIEW = 10;

@Injectable()
export class AdminChatReportsService {
  constructor(
    @InjectModel(ChatReport.name) private readonly reportModel: Model<ChatReport>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(ChatMessage.name) private readonly messageModel: Model<ChatMessage>,
  ) {}

  async listReports(params: {
    page: number;
    limit: number;
    status?: ChatReportStatus | 'all';
  }) {
    const page = Math.max(1, params.page);
    const limit = Math.min(50, Math.max(1, params.limit));
    const filter: Record<string, unknown> = {};
    if (params.status && params.status !== 'all') {
      filter.status = params.status;
    }

    const [rows, total] = await Promise.all([
      this.reportModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('reporter_id', 'name email')
        .lean()
        .exec(),
      this.reportModel.countDocuments(filter),
    ]);

    const items = rows.map((r: any) => ({
      id: r._id.toString(),
      status: r.status as ChatReportStatus,
      reason: r.reason ?? '',
      createdAt: (r.createdAt as Date)?.toISOString?.() ?? '',
      reporter: r.reporter_id
        ? {
            id: (r.reporter_id as any)._id?.toString?.() ?? '',
            name: (r.reporter_id as any).name ?? '',
            email: (r.reporter_id as any).email ?? '',
          }
        : null,
      conversation_id: r.conversation_id?.toString?.() ?? String(r.conversation_id),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getReportDetail(reportId: string) {
    if (!Types.ObjectId.isValid(reportId)) {
      throw new BadRequestException('Invalid report id');
    }
    const report = await this.reportModel
      .findById(reportId)
      .populate('reporter_id', 'name email')
      .lean()
      .exec();
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const conv = await this.conversationModel.findById(report.conversation_id).lean();
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    const pids = (conv.participant_ids as Types.ObjectId[]).map((id) => id.toString());
    const participants = await this.userModel
      .find({ _id: { $in: pids.map((id) => new Types.ObjectId(id)) } })
      .select('name email')
      .lean();

    const participantRows = participants.map((u: any) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
    }));

    const msgRows = await this.messageModel
      .find({ conversation_id: report.conversation_id })
      .sort({ createdAt: -1 })
      .limit(MESSAGE_PREVIEW)
      .lean()
      .exec();

    const chronological = [...msgRows].reverse();
    const senderIds = [...new Set(chronological.map((m: any) => m.sender_id.toString()))];
    const senders = await this.userModel
      .find({ _id: { $in: senderIds.map((id) => new Types.ObjectId(id)) } })
      .select('name email')
      .lean();
    const senderMap = new Map(senders.map((u: any) => [u._id.toString(), u]));

    const messages = chronological.map((m: any) => {
      const sid = m.sender_id.toString();
      const u = senderMap.get(sid);
      return {
        id: m._id.toString(),
        body: m.body,
        created_at: (m.createdAt as Date)?.toISOString?.() ?? new Date().toISOString(),
        sender: {
          id: sid,
          name: u?.name ?? 'Unknown',
          email: u?.email ?? '',
        },
      };
    });

    const rep = report as any;
    const reporter = rep.reporter_id;
    return {
      id: rep._id.toString(),
      status: rep.status,
      reason: rep.reason ?? '',
      admin_note: rep.admin_note ?? '',
      resolved_at: rep.resolved_at ? (rep.resolved_at as Date).toISOString() : null,
      createdAt: (rep.createdAt as Date)?.toISOString?.() ?? '',
      reporter: reporter
        ? {
            id: reporter._id?.toString?.() ?? '',
            name: reporter.name ?? '',
            email: reporter.email ?? '',
          }
        : null,
      conversation_id: conv._id.toString(),
      participants: participantRows,
      messages_preview: messages,
      messages_preview_count: MESSAGE_PREVIEW,
    };
  }

  async patchReport(
    reportId: string,
    body: { status: ChatReportStatus; admin_note?: string },
  ) {
    if (!Types.ObjectId.isValid(reportId)) {
      throw new BadRequestException('Invalid report id');
    }
    const resolved =
      body.status !== 'open'
        ? {
            resolved_at: new Date(),
          }
        : { resolved_at: null };

    const updated = await this.reportModel
      .findByIdAndUpdate(
        reportId,
        {
          $set: {
            status: body.status,
            admin_note: (body.admin_note ?? '').slice(0, 2000),
            ...resolved,
          },
        },
        { new: true },
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Report not found');
    }

    return { ok: true as const };
  }
}
