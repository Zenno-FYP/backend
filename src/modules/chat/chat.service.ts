import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../user/schemas/user.schema';
import { Conversation } from './schemas/conversation.schema';
import { ChatMessage } from './schemas/chat-message.schema';
import { ChatReport } from './schemas/chat-report.schema';
import {
  ChatMessageItemDto,
  ConversationSummaryDto,
  OpenConversationResponseDto,
} from './dto/chat-rest.dto';

const MAX_BODY_LEN = 4000;

function sortedParticipantIds(a: Types.ObjectId, b: Types.ObjectId): Types.ObjectId[] {
  const sa = a.toString();
  const sb = b.toString();
  return sa < sb ? [a, b] : [b, a];
}

function conversationKey(a: Types.ObjectId, b: Types.ObjectId): string {
  return sortedParticipantIds(a, b)
    .map((id) => id.toString())
    .join(':');
}

function toMessageDto(doc: ChatMessage): ChatMessageItemDto {
  const created = (doc as any).createdAt as Date | undefined;
  return {
    id: doc._id.toString(),
    sender_id: doc.sender_id.toString(),
    body: doc.body,
    created_at: created ? created.toISOString() : new Date().toISOString(),
    read_at: doc.read_at ? doc.read_at.toISOString() : null,
  };
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Conversation.name) private conversationModel: Model<Conversation>,
    @InjectModel(ChatMessage.name) private messageModel: Model<ChatMessage>,
    @InjectModel(ChatReport.name) private chatReportModel: Model<ChatReport>,
  ) {}

  private async userByEmail(email: string): Promise<User> {
    const u = await this.userModel.findOne({ email });
    if (!u) {
      throw new BadRequestException('User not found');
    }
    return u;
  }

  private assertParticipant(conv: Conversation, userId: Types.ObjectId) {
    const ok = conv.participant_ids.some((id) => id.equals(userId));
    if (!ok) {
      throw new ForbiddenException('Not a participant in this conversation');
    }
  }

  async getOrCreateConversation(me: User, otherUserId: string): Promise<Conversation> {
    if (!Types.ObjectId.isValid(otherUserId)) {
      throw new BadRequestException('Invalid user id');
    }
    const otherId = new Types.ObjectId(otherUserId);
    if (otherId.equals(me._id as Types.ObjectId)) {
      throw new BadRequestException('Cannot chat with yourself');
    }
    const other = await this.userModel.findById(otherId);
    if (!other) {
      throw new NotFoundException('Recipient not found');
    }
    const pair = sortedParticipantIds(me._id as Types.ObjectId, otherId);
    const key = conversationKey(me._id as Types.ObjectId, otherId);
    let conv = await this.conversationModel.findOne({ conversation_key: key });
    if (!conv) {
      conv = await this.conversationModel.findOne({
        participant_ids: { $all: pair, $size: 2 },
      });
      if (conv && !conv.conversation_key) {
        conv.conversation_key = key;
        await conv.save();
      }
    }
    if (!conv) {
      try {
        conv = await this.conversationModel.create({
          conversation_key: key,
          participant_ids: pair,
          last_message_at: new Date(),
          last_message_text: '',
          last_message_sender_id: null,
        });
      } catch (e: any) {
        if (e?.code === 11000) {
          conv = await this.conversationModel.findOne({ conversation_key: key });
        }
        if (!conv) {
          throw e;
        }
      }
    }
    return conv!;
  }

  async openConversation(email: string, otherUserId: string): Promise<OpenConversationResponseDto> {
    const me = await this.userByEmail(email);
    const conv = await this.getOrCreateConversation(me, otherUserId);
    return { conversation_id: conv._id.toString() };
  }

  async listConversations(email: string): Promise<ConversationSummaryDto[]> {
    const me = await this.userByEmail(email);
    const myId = me._id as Types.ObjectId;
    const list = await this.conversationModel
      .find({ participant_ids: myId })
      .sort({ last_message_at: -1 })
      .lean()
      .exec();

    const out: ConversationSummaryDto[] = [];
    for (const c of list) {
      const pids = (c.participant_ids as Types.ObjectId[]).map((x) => x.toString());
      const otherIdStr = pids.find((id) => id !== myId.toString());
      if (!otherIdStr) {
        continue;
      }
      const other = await this.userModel.findById(otherIdStr).lean();
      if (!other) {
        continue;
      }
      const unread = await this.messageModel.countDocuments({
        conversation_id: c._id,
        sender_id: { $ne: myId },
        read_at: null,
      });
      out.push({
        id: (c._id as Types.ObjectId).toString(),
        other_user: {
          id: otherIdStr,
          name: other.name,
          profilePhoto: other.profilePhoto ?? null,
        },
        last_message_text: c.last_message_text || '',
        last_message_at: (c.last_message_at as Date)?.toISOString?.() ?? new Date(0).toISOString(),
        unread_count: unread,
      });
    }
    return out;
  }

  async getMessages(
    email: string,
    conversationId: string,
    before?: string,
    limit = 50,
  ): Promise<ChatMessageItemDto[]> {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversation id');
    }
    const me = await this.userByEmail(email);
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }
    this.assertParticipant(conv, me._id as Types.ObjectId);

    const q: Record<string, unknown> = { conversation_id: new Types.ObjectId(conversationId) };
    if (before && Types.ObjectId.isValid(before)) {
      q._id = { $lt: new Types.ObjectId(before) };
    }
    const take = Math.min(Math.max(1, limit), 100);
    const rows = await this.messageModel.find(q).sort({ _id: -1 }).limit(take).exec();
    return rows.reverse().map(toMessageDto);
  }

  async markRead(email: string, conversationId: string): Promise<void> {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversation id');
    }
    const me = await this.userByEmail(email);
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }
    this.assertParticipant(conv, me._id as Types.ObjectId);
    const myId = me._id as Types.ObjectId;
    await this.messageModel.updateMany(
      {
        conversation_id: new Types.ObjectId(conversationId),
        sender_id: { $ne: myId },
        read_at: null,
      },
      { $set: { read_at: new Date() } },
    );
  }

  /**
   * Persist message and update conversation; used from HTTP (future) and WebSocket gateway.
   */
  async sendTextMessage(
    senderEmail: string,
    recipientUserId: string,
    text: string,
  ): Promise<{ conversationId: string; recipientMongoId: string; message: ChatMessageItemDto }> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new BadRequestException('Message cannot be empty');
    }
    if (trimmed.length > MAX_BODY_LEN) {
      throw new BadRequestException(`Message too long (max ${MAX_BODY_LEN} characters)`);
    }
    const me = await this.userByEmail(senderEmail);
    const conv = await this.getOrCreateConversation(me, recipientUserId);
    const msg = await this.messageModel.create({
      conversation_id: conv._id,
      sender_id: me._id,
      body: trimmed,
      read_at: null,
    });
    conv.last_message_at = (msg as any).createdAt ?? new Date();
    conv.last_message_text = trimmed.length > 160 ? `${trimmed.slice(0, 157)}…` : trimmed;
    conv.last_message_sender_id = me._id as Types.ObjectId;
    await conv.save();

    const dto = toMessageDto(msg);
    const otherId = conv.participant_ids.find((id) => !id.equals(me._id as Types.ObjectId))!;
    return {
      conversationId: conv._id.toString(),
      recipientMongoId: otherId.toString(),
      message: dto,
    };
  }

  async reportConversation(reporterEmail: string, conversationId: string, reason?: string): Promise<{ report_id: string }> {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException('Invalid conversation id');
    }
    const me = await this.userByEmail(reporterEmail);
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }
    this.assertParticipant(conv, me._id as Types.ObjectId);

    const cid = new Types.ObjectId(conversationId);
    const existing = await this.chatReportModel.findOne({
      reporter_id: me._id,
      conversation_id: cid,
      status: 'open',
    });
    if (existing) {
      throw new ConflictException({
        code: 'REPORT_DUPLICATE',
        message: 'You already have an open report for this conversation',
      });
    }

    const doc = await this.chatReportModel.create({
      reporter_id: me._id as Types.ObjectId,
      conversation_id: cid,
      reason: (reason ?? '').trim().slice(0, 500),
      status: 'open',
      admin_note: '',
      resolved_at: null,
    });
    return { report_id: doc._id.toString() };
  }

  async markReadByUserId(mongoUserId: string, conversationId: string): Promise<void> {
    if (!Types.ObjectId.isValid(conversationId) || !Types.ObjectId.isValid(mongoUserId)) {
      throw new BadRequestException('Invalid id');
    }
    const me = await this.userModel.findById(mongoUserId);
    if (!me) {
      throw new BadRequestException('User not found');
    }
    await this.markRead(me.email, conversationId);
  }
}
