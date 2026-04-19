import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: false, versionKey: false })
export class NudgeRecord extends Document {
  @Prop({ required: true, index: true })
  user_id: string;

  /** ISO 8601 string from the desktop agent's local clock. */
  @Prop({ required: true })
  generated_at: Date;

  @Prop({ required: true })
  nudge_type: string;

  @Prop({ default: '' })
  nudge_text: string;

  /** true when the scheduler decided to suppress the nudge. */
  @Prop({ default: false })
  was_suppressed: boolean;

  /**
   * Reason the desktop agent suppressed this nudge, when `was_suppressed`
   * is true. Examples: `quiet_hours`, `too_recent`, `aggregation_failed`,
   * `display_failed`. Optional for back-compat with older agents.
   */
  @Prop({ type: String, default: null })
  suppression_reason: string | null;
}

export const NudgeRecordSchema = SchemaFactory.createForClass(NudgeRecord);

// Prevent duplicate uploads from desktop agent re-syncing the same nudges.
NudgeRecordSchema.index({ user_id: 1, generated_at: 1 }, { unique: true });

// `getNudgeStats` filters by (user_id, was_suppressed, generated_at >= X).
// This composite covers all four countDocuments calls efficiently.
NudgeRecordSchema.index({ user_id: 1, was_suppressed: 1, generated_at: 1 });
