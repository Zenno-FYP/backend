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
}

export const NudgeRecordSchema = SchemaFactory.createForClass(NudgeRecord);

// Prevent duplicate uploads from desktop agent re-syncing the same nudges.
NudgeRecordSchema.index({ user_id: 1, generated_at: 1 }, { unique: true });
