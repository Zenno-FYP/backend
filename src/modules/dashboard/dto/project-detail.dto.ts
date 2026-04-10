import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ProjectLanguageShareDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  lines: number;

  @ApiProperty({ description: 'Share of project LOC (0–100)' })
  percent: number;
}

export class ProjectSkillRowDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'Tracked time for this skill in seconds (precise)' })
  duration_sec: number;

  @ApiProperty()
  duration_hours: number;
}

export class ProjectBehaviorSummaryDto {
  @ApiProperty({
    description: 'Context-weighted mean typing intensity (keystrokes per minute) across synced days',
  })
  avg_typing_kpm: number;

  @ApiProperty({
    description: 'Context-weighted mean mouse click rate (clicks per minute) across synced days',
  })
  avg_mouse_cpm: number;

  @ApiProperty({ description: 'Sum of recorded idle time for this project (hours)' })
  total_idle_hours: number;
}

export class ProjectNamedHoursRowDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  duration_hours: number;

  @ApiProperty({ description: 'Share of the relevant total for this project (0–100)' })
  percent: number;
}

export class ProjectContextBreakdownDto {
  @ApiProperty()
  flow_hours: number;

  @ApiProperty()
  debugging_hours: number;

  @ApiProperty()
  research_hours: number;

  @ApiProperty()
  communication_hours: number;

  @ApiProperty()
  distracted_hours: number;

  @ApiProperty({
    description: 'Time with context labels that are not Flow / Debugging / Research / Communication / Distracted',
  })
  other_hours: number;
}

export class ProjectDetailResponseDto {
  @ApiProperty({ description: 'Canonical name from agent / SQLite' })
  project_name: string;

  @ApiPropertyOptional({ nullable: true })
  display_name: string | null;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional({ nullable: true })
  first_seen: string | null;

  @ApiPropertyOptional({ nullable: true })
  last_active: string | null;

  @ApiProperty({
    description:
      'Active hours: time spent in desktop apps while this project was active (sum of activity.apps for this project).',
  })
  app_time_hours: number;

  @ApiProperty()
  total_lines: number;

  @ApiProperty()
  total_files: number;

  @ApiProperty({ type: [ProjectLanguageShareDto] })
  languages: ProjectLanguageShareDto[];

  @ApiProperty({
    type: [ProjectNamedHoursRowDto],
    description: 'Apps ranked by tracked time in this project (activity.apps).',
  })
  top_apps: ProjectNamedHoursRowDto[];

  @ApiProperty({
    type: [ProjectNamedHoursRowDto],
    description: 'Languages ranked by tracked active time in this project (activity.languages).',
  })
  languages_by_active_time: ProjectNamedHoursRowDto[];

  @ApiProperty({ type: ProjectContextBreakdownDto })
  context_breakdown: ProjectContextBreakdownDto;

  @ApiProperty({ type: ProjectBehaviorSummaryDto })
  behavior: ProjectBehaviorSummaryDto;

  @ApiProperty({ type: [ProjectSkillRowDto] })
  skills: ProjectSkillRowDto[];
}

export class UpdateProjectDto {
  @ApiPropertyOptional({
    maxLength: 200,
    description:
      'Dashboard label only; canonical project_name is never updated. Omit, empty, or same value as sync name clears display_name (default title = project_name).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  display_name?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
