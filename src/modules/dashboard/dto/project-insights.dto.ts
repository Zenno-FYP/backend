import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SkillDto {
  @ApiProperty({
    example: 'Coding',
    description: 'Skill name',
  })
  name: string;

  @ApiProperty({
    example: 55.4,
    description: 'Percentage of total skill time (1 decimal place)',
  })
  percent: number;
}

export class ProjectItemDto {
  @ApiProperty({
    example: 'Zenno-Dashboard',
    description: 'Canonical project name (sync key)',
  })
  name: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Friendly display label when set; UI should fall back to name',
  })
  display_name: string | null;

  @ApiProperty({
    example: '2026-03-05T18:30:00',
    description: 'Last active timestamp (local time, ISO 8601 without Z)',
  })
  last_active: string;
}

export class ProjectInsightsResponseDto {
  @ApiProperty({
    description: 'Top 5 skills by cumulative time (all-time)',
    type: [SkillDto],
  })
  strongest_skills: SkillDto[];

  @ApiProperty({
    description: 'Current projects sorted by recency (most recent first)',
    type: [ProjectItemDto],
  })
  current_projects: ProjectItemDto[];
}
