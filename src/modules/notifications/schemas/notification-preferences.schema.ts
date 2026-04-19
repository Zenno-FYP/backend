import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, versionKey: false })
export class NotificationPreferences extends Document {
  @Prop({ required: true, type: Types.ObjectId, unique: true })
  user_id: Types.ObjectId;

  @Prop({ default: true })
  push_enabled: boolean;

  @Prop({ default: true })
  chat_enabled: boolean;

  @Prop({ default: true })
  new_project_enabled: boolean;

  @Prop({ default: true })
  daily_digest_enabled: boolean;

  @Prop({ type: String, default: null })
  last_digest_date: string | null;
}

export const NotificationPreferencesSchema =
  SchemaFactory.createForClass(NotificationPreferences);
