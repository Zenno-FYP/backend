import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, versionKey: false })
export class AgentPreferences extends Document {
  /** Firebase UID — one document per user. */
  @Prop({ required: true, unique: true, index: true })
  user_id: string;

  /** Work schedule affects quiet-hours window in the desktop agent. */
  @Prop({ default: 'standard', enum: ['morning', 'standard', 'evening', 'night_owl'] })
  work_schedule: string;

  /** Focus style drives break-reminder and flow-streak thresholds. */
  @Prop({ default: 'moderate', enum: ['deep', 'moderate', 'pomodoro'] })
  focus_style: string;

  /** Wellbeing goal tunes the LLM persona and nudge frequency. */
  @Prop({ default: 'focused', enum: ['focused', 'burnout', 'habits', 'minimal'] })
  wellbeing_goal: string;

  /** Master switch: when false the desktop agent skips all nudges. */
  @Prop({ default: true })
  nudge_enabled: boolean;

  /** Play a short chime sound on each desktop nudge notification. */
  @Prop({ default: false })
  notification_sound: boolean;

  /** Nudge voice used by the desktop agent's NLP persona. */
  @Prop({ default: 'motivational', enum: ['friendly', 'motivational', 'professional', 'casual'] })
  agent_tone: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AgentPreferencesSchema = SchemaFactory.createForClass(AgentPreferences);
