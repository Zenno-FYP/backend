import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, versionKey: false })
export class NotificationDevice extends Document {
  @Prop({ required: true, type: Types.ObjectId, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true, unique: true })
  fcm_token: string;

  @Prop({ required: true, enum: ['web', 'android'] })
  platform: 'web' | 'android';

  @Prop({ type: String, default: '' })
  device_label: string;

  @Prop({ default: true })
  push_enabled: boolean;

  @Prop({ type: Date, default: Date.now })
  last_seen_at: Date;
}

export const NotificationDeviceSchema =
  SchemaFactory.createForClass(NotificationDevice);
