import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: false, versionKey: false })
export class Notification extends Document {
  @Prop({ required: true, type: Types.ObjectId, index: true })
  user_id: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['chat_message', 'new_project', 'daily_digest'],
  })
  type: 'chat_message' | 'new_project' | 'daily_digest';

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ type: Map, of: String, default: {} })
  data: Map<string, string>;

  @Prop({ type: Date, default: null })
  read_at: Date | null;

  @Prop({ type: Date, default: null })
  push_sent_at: Date | null;

  @Prop({ type: String, default: null })
  dedupe_key: string | null;

  @Prop({ type: Date, default: Date.now })
  created_at: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ user_id: 1, created_at: -1 });
NotificationSchema.index(
  { dedupe_key: 1 },
  { unique: true, sparse: true },
);
