import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, versionKey: false })
export class Activity extends Document {
  @Prop({ required: true, index: true })
  user_id: string; // Firebase UID

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
  context_states: Map<string, number>; // {context: duration_sec}

  @Prop({
    type: {
      total_keystrokes: { type: Number, default: 0 },
      total_mouse_clicks: { type: Number, default: 0 },
      total_scroll_events: { type: Number, default: 0 },
      total_idle_sec: { type: Number, default: 0 },
    },
    default: {
      total_keystrokes: 0,
      total_mouse_clicks: 0,
      total_scroll_events: 0,
      total_idle_sec: 0,
    },
  })
  behavior: {
    total_keystrokes: number;
    total_mouse_clicks: number;
    total_scroll_events: number;
    total_idle_sec: number;
  };

  @Prop({ default: 1 })
  sync_version: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);

// Create compound index on user_id, project_name, date
ActivitySchema.index({ user_id: 1, project_name: 1, date: 1 }, { unique: true });
