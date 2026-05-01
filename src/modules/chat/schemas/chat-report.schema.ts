import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatReportStatus = 'open' | 'dismissed' | 'reviewed' | 'action_taken';

@Schema({ timestamps: true, versionKey: false })
export class ChatReport extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  reporter_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true, index: true })
  conversation_id: Types.ObjectId;

  @Prop({ type: String, default: '', maxlength: 500 })
  reason: string;

  @Prop({
    type: String,
    enum: ['open', 'dismissed', 'reviewed', 'action_taken'],
    default: 'open',
    index: true,
  })
  status: ChatReportStatus;

  @Prop({ type: String, default: '' })
  admin_note: string;

  @Prop({ type: Date, default: null })
  resolved_at: Date | null;
}

export const ChatReportSchema = SchemaFactory.createForClass(ChatReport);

ChatReportSchema.index({ status: 1, createdAt: -1 });
ChatReportSchema.index({ reporter_id: 1, conversation_id: 1, status: 1 });
