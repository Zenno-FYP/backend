import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProfileProjectInsightDto {
  @ApiProperty({ enum: ['flow_focus', 'dominant_context', 'none'] })
  kind: 'flow_focus' | 'dominant_context' | 'none';

  @ApiPropertyOptional({ description: 'Share of context time in Flow (productivity-style)' })
  flow_focus_percent?: number;

  @ApiPropertyOptional({ description: 'Dominant context label when flow focus is not used' })
  label?: string;

  @ApiPropertyOptional({ description: 'Share of context time for dominant label' })
  percent?: number;
}

export class ProfileProjectSkillRowDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  duration_sec: number;

  @ApiProperty()
  duration_hours: number;

  @ApiProperty({ description: 'Share of this project’s tracked skill time (0–100)' })
  percent: number;
}

export class ProfileProjectLanguageShareDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  percent: number;
}

export class ProfileProjectAppRowDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  duration_hours: number;

  @ApiProperty()
  percent: number;
}

export class ProfileProjectCardDto {
  @ApiProperty()
  project_name: string;

  @ApiPropertyOptional({ nullable: true })
  display_name: string | null;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional({ nullable: true })
  last_active: string | null;

  @ApiProperty({ description: 'Total app time from activity.apps (hours)' })
  app_time_hours: number;

  @ApiProperty({ type: [ProfileProjectLanguageShareDto] })
  languages: ProfileProjectLanguageShareDto[];

  @ApiProperty({ type: [ProfileProjectAppRowDto] })
  top_apps: ProfileProjectAppRowDto[];

  @ApiProperty({ type: [ProfileProjectSkillRowDto] })
  top_skills: ProfileProjectSkillRowDto[];

  @ApiProperty({ type: ProfileProjectInsightDto })
  insight: ProfileProjectInsightDto;
}

export class ProfileGlobalSkillRowDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  duration_hours: number;

  @ApiProperty()
  percent: number;
}

export class ProfileGlobalAppRowDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  duration_hours: number;

  @ApiProperty()
  percent: number;
}

export class ProfileGlobalLanguageRowDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  lines: number;

  @ApiProperty()
  percent: number;
}

export class ProfilePageResponseDto {
  @ApiProperty({ description: 'Consecutive days with at least one activity row (UTC calendar day)' })
  streak_days: number;

  @ApiProperty()
  total_app_time_hours: number;

  @ApiProperty()
  total_projects: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Flow as % of tracked context time across all projects (null if context too thin)',
  })
  global_flow_focus_percent: number | null;

  @ApiProperty({ type: [ProfileGlobalSkillRowDto] })
  top_skills: ProfileGlobalSkillRowDto[];

  @ApiProperty({ type: [ProfileGlobalAppRowDto] })
  top_apps: ProfileGlobalAppRowDto[];

  @ApiProperty({ type: [ProfileGlobalLanguageRowDto] })
  top_languages: ProfileGlobalLanguageRowDto[];

  @ApiProperty({ type: [ProfileProjectCardDto] })
  projects: ProfileProjectCardDto[];
}
