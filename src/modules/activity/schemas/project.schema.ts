import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, versionKey: false })
export class Project extends Document {
  @Prop({ required: true, index: true })
  user_id: string; // Firebase UID

  @Prop({ required: true, index: true })
  project_name: string;

  @Prop()
  project_path?: string;

  @Prop({
    type: Map,
    of: {
      lines_of_code: { type: Number, default: 0 },
      file_count: { type: Number, default: 0 },
      last_scanned_at: { type: Date },
    },
    default: {},
  })
  languages: Map<
    string,
    {
      lines_of_code: number;
      file_count: number;
      last_scanned_at: Date;
    }
  >;

  @Prop({ type: Date, default: null })
  first_seen_at?: Date;

  @Prop({ type: Date, default: null })
  last_active_at?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

// Create compound index on user_id and project_name
ProjectSchema.index({ user_id: 1, project_name: 1 }, { unique: true });
