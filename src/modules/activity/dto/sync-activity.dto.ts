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
  date: string; // YYYY-MM-DD

  @IsOptional()
  @IsObject()
  languages?: Record<string, number>; // { "python": 1200, "sql": 300 }

  @IsOptional()
  @IsObject()
  apps?: Record<string, number>; // { "vscode": 1400, "chrome": 100 }

  @IsOptional()
  @IsObject()
  skills?: Record<string, number>; // { "backend": 1000, "debugging": 500 }

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

export class ProjectMetadataDto {
  @IsOptional()
  @IsString()
  first_seen_at?: string; // ISO 8601 (only on new projects)

  @IsOptional()
  @IsString()
  last_active_at?: string; // ISO 8601
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
