import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

interface CurrentLocItem {
  language: string;
  lines: number;
  files: number;
}

@Schema({ versionKey: false })
export class Project extends Document {
  @Prop({ required: true, index: true, type: Types.ObjectId })
  user_id: Types.ObjectId; // Reference to users._id

  @Prop({ required: true, index: true })
  project_name: string; // Project name from SQLite

  @Prop({ type: Date, default: null })
  first_seen_at?: Date;

  @Prop({ type: Date, default: null })
  last_active_at?: Date;

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
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

// Create compound index on user_id and project_name
ProjectSchema.index({ user_id: 1, project_name: 1 }, { unique: true });
