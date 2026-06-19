import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, versionKey: false })
export class Conversation extends Document {
  /** Stable key for the two participants, sorted by ObjectId string. */
  @Prop({ type: String, required: true })
  conversation_key: string;

  /** Two distinct users, sorted by ObjectId string for stable uniqueness */
  @Prop({ type: [Types.ObjectId], ref: 'User', required: true })
  participant_ids: Types.ObjectId[];

  @Prop({ type: Date, default: () => new Date() })
  last_message_at: Date;

  @Prop({ type: String, default: '' })
  last_message_text: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  last_message_sender_id: Types.ObjectId | null;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  deleted_for_user_ids: Types.ObjectId[];
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ conversation_key: 1 }, { unique: true });
ConversationSchema.index({ participant_ids: 1 });
ConversationSchema.index({ last_message_at: -1 });
ConversationSchema.index({ deleted_for_user_ids: 1 });
