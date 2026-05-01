import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, versionKey: false })
export class User extends Document {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: null })
  profilePhoto?: string | null;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: 'user' })
  role: string;

  @Prop({ type: Boolean, default: false })
  isAdmin: boolean;

  @Prop({ type: String, default: null })
  activity_sync_at?: string; // ISO 8601 local timestamp

  @Prop({ type: Number, default: 0 })
  timezone_offset?: number; // Hours offset from UTC (e.g., +5 for UTC+5)

  /** Dashboard profile bio */
  @Prop({ type: String, default: '' })
  description?: string;

  @Prop({ type: String, default: null })
  github_url?: string | null;

  @Prop({ type: String, default: null })
  linkedin_url?: string | null;

  @Prop({ type: String, default: null })
  twitter_url?: string | null;

  @Prop({
    type: {
      hidden_project_names: { type: [String], default: [] },
      project_order: { type: [String], default: [] },
      hidden_skill_names: { type: [String], default: [] },
      hidden_app_names: { type: [String], default: [] },
      hidden_language_names: { type: [String], default: [] },
    },
    default: () => ({
      hidden_project_names: [],
      project_order: [],
      hidden_skill_names: [],
      hidden_app_names: [],
      hidden_language_names: [],
    }),
  })
  profile_preferences?: {
    hidden_project_names: string[];
    project_order: string[];
    hidden_skill_names: string[];
    hidden_app_names: string[];
    hidden_language_names: string[];
  };

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// `email` unique index is declared via @Prop({ unique: true }) above.
// Peers search filters by isVerified=true; a partial index on verified
// users keeps the query fast even as the user collection grows.
UserSchema.index({ isVerified: 1 });
