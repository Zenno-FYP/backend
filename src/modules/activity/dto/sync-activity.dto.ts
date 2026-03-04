import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BehaviorDto {
  @IsNumber()
  keystrokes: number;

  @IsNumber()
  clicks: number;

  @IsNumber()
  scrolls: number;

  @IsNumber()
  idle_sec: number;
}

export class DayBucketDto {
  @IsString()
  date: string; // YYYY-MM-DD (local calendar date)

  @IsOptional()
  @IsObject()
  languages?: Record<string, number>; // { "python": 1200, "sql": 300 }

  @IsOptional()
  @IsObject()
  apps?: Record<string, number>; // { "vscode": 1400, "chrome": 100 }

  @IsOptional()
  @IsObject()
  context?: Record<string, number>; // { "focused": 1200, "reading": 300 }

  @IsOptional()
  @ValidateNested()
  @Type(() => BehaviorDto)
  behavior?: BehaviorDto;
}

export class CurrentLocDto {
  @IsString()
  language: string;

  @IsNumber()
  lines: number;

  @IsNumber()
  files: number;
}

export class ProjectSkillDto {
  @IsString()
  skill_name: string; // Skill label (inferred from language, file types, context)

  @IsNumber()
  duration_sec: number; // Cumulative seconds spent on this skill across the project
}

export class ProjectMetadataDto {
  @IsOptional()
  @IsString()
  first_seen_at?: string; // ISO 8601 local timestamp (only on new projects, e.g., "2026-03-01T14:30:45")

  @IsOptional()
  @IsString()
  last_active_at?: string; // ISO 8601 local timestamp (e.g., "2026-03-01T14:30:45")
}

export class ProjectSyncDto {
  @IsString()
  project_name: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectMetadataDto)
  metadata?: ProjectMetadataDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CurrentLocDto)
  current_loc?: CurrentLocDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectSkillDto)
  project_skills?: ProjectSkillDto[]; // Cumulative skills breakdown per project

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayBucketDto)
  days: DayBucketDto[];
}

export class SyncActivityDto {
  @IsString()
  user_id: string;

  @IsString()
  sync_timestamp: string; // ISO 8601

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectSyncDto)
  data: ProjectSyncDto[];
}
