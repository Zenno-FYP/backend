import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

interface BehaviorData {
  typing_intensity_kpm: number; // Keystrokes per minute
  mouse_click_rate_cpm: number; // Mouse clicks per minute
  total_deletion_key_presses: number; // Total deletion/backspace key presses
  total_idle_sec: number; // Total idle time in seconds
  total_mouse_movement_distance: number; // Total mouse movement distance in pixels
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
  context: Map<string, number>; // {context_state: duration_sec}

  @Prop({
    type: {
      typing_intensity_kpm: { type: Number, default: 0 },
      mouse_click_rate_cpm: { type: Number, default: 0 },
      total_deletion_key_presses: { type: Number, default: 0 },
      total_idle_sec: { type: Number, default: 0 },
      total_mouse_movement_distance: { type: Number, default: 0 },
    },
    default: {
      typing_intensity_kpm: 0,
      mouse_click_rate_cpm: 0,
      total_deletion_key_presses: 0,
      total_idle_sec: 0,
      total_mouse_movement_distance: 0,
    },
    _id: false,
  })
  behavior: BehaviorData;

  @Prop({ type: String, default: null })
  last_synced_at?: string; // ISO 8601 local timestamp (preserved as-is from desktop)
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);

// Create compound index on user_id, project_name, date
ActivitySchema.index({ user_id: 1, project_name: 1, date: 1 }, { unique: true });
