import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

interface BehaviorData {
  keystrokes: number;
  clicks: number;
  scrolls: number;
  idle_sec: number;
}

@Schema({ versionKey: false })
export class Activity extends Document {
  @Prop({ required: true, index: true, type: Types.ObjectId })
  user_id: Types.ObjectId; // Reference to users._id

  @Prop({ required: true, index: true })
  project_name: string;

  @Prop({ required: true, type: Date, index: true })
  date: Date; // Daily aggregate

  @Prop({ type: Map, of: Number, default: {} })
  languages: Map<string, number>; // {language_name: duration_sec}

  @Prop({ type: Map, of: Number, default: {} })
  apps: Map<string, number>; // {app_name: duration_sec}

  @Prop({ type: Map, of: Number, default: {} })
  skills: Map<string, number>; // {skill_name: duration_sec}

  @Prop({ type: Map, of: Number, default: {} })
  context: Map<string, number>; // {context_state: duration_sec}

  @Prop({
    type: {
      keystrokes: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      scrolls: { type: Number, default: 0 },
      idle_sec: { type: Number, default: 0 },
    },
    default: {
      keystrokes: 0,
      clicks: 0,
      scrolls: 0,
      idle_sec: 0,
    },
    _id: false,
  })
  behavior: BehaviorData;

  @Prop({ default: 1 })
  sync_version: number;

  @Prop({ type: Date, default: null })
  last_synced_at?: Date;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);

// Create compound index on user_id, project_name, date
ActivitySchema.index({ user_id: 1, project_name: 1, date: 1 }, { unique: true });
