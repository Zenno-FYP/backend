import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

interface CurrentLocItem {
  language: string;
  lines: number;
  files: number;
}

interface ProjectSkillItem {
  skill_name: string;
  duration_sec: number;
}

@Schema({ versionKey: false })
export class Project extends Document {
  @Prop({ required: true, index: true, type: Types.ObjectId })
  user_id: Types.ObjectId; // Reference to users._id

  @Prop({ required: true, index: true })
  project_name: string; // Project name from SQLite

  @Prop({ type: String, default: null })
  first_seen_at?: string; // ISO 8601 local timestamp

  @Prop({ type: String, default: null })
  last_active_at?: string; // ISO 8601 local timestamp

  /** Optional display name in the app (canonical project_name stays for sync & URLs). */
  @Prop({ type: String, default: null })
  display_name?: string | null;

  /** User-editable short description (dashboard only). */
  @Prop({ type: String, default: '' })
  description?: string;

  @Prop({
    type: [
      {
        language: { type: String },
        lines: { type: Number, default: 0 },
        files: { type: Number, default: 0 },
        _id: false,
      },
    ],
    default: [],
  })
  current_loc: CurrentLocItem[];

  @Prop({
    type: [
      {
        skill_name: { type: String },
        duration_sec: { type: Number, default: 0 },
        _id: false,
      },
    ],
    default: [],
  })
  project_skills: ProjectSkillItem[]; // Cumulative skills breakdown per project
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

// Create compound index on user_id and project_name
ProjectSchema.index({ user_id: 1, project_name: 1 }, { unique: true });
