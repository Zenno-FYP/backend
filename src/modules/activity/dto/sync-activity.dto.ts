import { IsString, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DailyLanguageDto {
  @IsString()
  language_name: string;

  @IsString()
  project_name: string;

  @IsString()
  date: string; // YYYY-MM-DD

  @Type(() => Number)
  duration_sec: number;
}

export class DailyAppDto {
  @IsString()
  app_name: string;

  @IsString()
  project_name: string;

  @IsString()
  date: string;

  @Type(() => Number)
  duration_sec: number;
}

export class DailySkillDto {
  @IsString()
  skill_name: string;

  @IsString()
  project_name: string;

  @IsString()
  date: string;

  @Type(() => Number)
  duration_sec: number;
}

export class DailyContextDto {
  @IsString()
  context_state: string;

  @IsString()
  project_name: string;

  @IsString()
  date: string;

  @Type(() => Number)
  duration_sec: number;
}

export class DailyBehaviorDto {
  @IsString()
  project_name: string;

  @IsString()
  date: string;

  @Type(() => Number)
  total_keystrokes: number;

  @Type(() => Number)
  total_mouse_clicks: number;

  @Type(() => Number)
  total_scroll_events: number;

  @Type(() => Number)
  total_idle_sec: number;
}

export class LocSnapshotDto {
  @IsString()
  project_name: string;

  @IsString()
  language_name: string;

  @Type(() => Number)
  lines_of_code: number;

  @Type(() => Number)
  file_count: number;

  @IsString()
  last_scanned_at: string; // ISO 8601
}

export class SyncActivityDto {
  @IsString()
  user_id: string; // Firebase UID or email

  @IsOptional()
  @IsString()
  sync_token?: string; // Optional: last sync timestamp

  @IsObject()
  @ValidateNested({ each: true })
  @Type(() => Object)
  data: {
    daily_languages?: DailyLanguageDto[];
    daily_apps?: DailyAppDto[];
    daily_skills?: DailySkillDto[];
    daily_context?: DailyContextDto[];
    daily_behavior?: DailyBehaviorDto[];
    loc_snapshots?: LocSnapshotDto[];
  };
}
