import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, versionKey: false })
export class Conversation extends Document {
  /** Two distinct users, sorted by ObjectId string for stable uniqueness */
  @Prop({ type: [Types.ObjectId], ref: 'User', required: true })
  participant_ids: Types.ObjectId[];

  @Prop({ type: Date, default: () => new Date() })
  last_message_at: Date;

  @Prop({ type: String, default: '' })
  last_message_text: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  last_message_sender_id: Types.ObjectId | null;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ participant_ids: 1 }, { unique: true });
ConversationSchema.index({ last_message_at: -1 });
