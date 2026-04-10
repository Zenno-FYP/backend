import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SkillsProjectsSummaryDto {
  @ApiProperty()
  total_projects: number;

  @ApiProperty({
    description: 'Active time: sum of activity.apps durations across all projects (hours)',
  })
  total_app_time_hours: number;

  @ApiProperty({ description: 'Distinct skill names with any recorded time' })
  unique_skills_count: number;

  @ApiProperty({ description: 'Sum of lines from project current_loc snapshots' })
  total_lines_of_code: number;
}

export class SkillTimeDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  duration_hours: number;

  @ApiProperty({ description: 'Share of total tracked skill time (0–100)' })
  percent_of_total: number;
}

export class ProjectLanguageLineDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  lines: number;
}

export class ProjectSkillTimeDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'Tracked seconds for this skill in this project' })
  duration_sec: number;

  @ApiProperty()
  duration_hours: number;
}

export class ProjectOverviewItemDto {
  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true, description: 'Optional label in the app' })
  display_name: string | null;

  @ApiProperty({ description: 'User-editable; may be empty' })
  description: string;

  @ApiProperty({ nullable: true })
  last_active: string | null;

  @ApiProperty({ nullable: true })
  first_seen: string | null;

  @ApiProperty()
  total_lines: number;

  @ApiProperty()
  total_files: number;

  @ApiProperty({ type: [ProjectLanguageLineDto] })
  top_languages: ProjectLanguageLineDto[];

  @ApiProperty({ type: [ProjectSkillTimeDto] })
  skills: ProjectSkillTimeDto[];

  @ApiProperty({
    description: 'Active time for this project (sum of activity.apps durations, hours)',
  })
  app_time_hours: number;
}

export class SkillsProjectsDetailResponseDto {
  @ApiProperty({ type: SkillsProjectsSummaryDto })
  summary: SkillsProjectsSummaryDto;

  @ApiProperty({
    description: 'Skills aggregated across all projects, sorted by time (longest first)',
    type: [SkillTimeDto],
  })
  skills: SkillTimeDto[];

  @ApiProperty({
    description: 'All projects, most recently active first',
    type: [ProjectOverviewItemDto],
  })
  projects: ProjectOverviewItemDto[];
}
