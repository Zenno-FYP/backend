import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: false, versionKey: false })
export class Notification extends Document {
  @Prop({ required: true, type: Types.ObjectId, index: true })
  user_id: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['chat_message', 'new_project', 'daily_digest', 'test'],
  })
  type: 'chat_message' | 'new_project' | 'daily_digest' | 'test';

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

  /**
   * Only set for types that need idempotent sends (`new_project`, `daily_digest`).
   * Chat and test rows omit this field entirely — if Mongoose stored `null`
   * here, MongoDB's unique index on `dedupe_key` would only allow a single
   * such document cluster-wide (dup key on `{ dedupe_key: null }`).
   */
  @Prop({ type: String, required: false })
  dedupe_key?: string | null;

  @Prop({ type: Date, default: Date.now })
  created_at: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Primary list-by-user index (covers `listNotifications` + the bell badge).
NotificationSchema.index({ user_id: 1, created_at: -1 });

// `getUnreadCount` and `markAllRead` filter by (user_id, read_at: null).
// Partial index keeps the index small — only the unread rows are stored.
NotificationSchema.index(
  { user_id: 1, read_at: 1 },
  { partialFilterExpression: { read_at: null } },
);

NotificationSchema.index(
  { dedupe_key: 1 },
  { unique: true, sparse: true },
);
