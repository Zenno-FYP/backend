import { ApiProperty } from '@nestjs/swagger';

export class AppUsageItemDto {
  @ApiProperty({
    description: 'Application name',
  })
  name: string;

  @ApiProperty({
    description: 'Duration in hours for last 7 days',
  })
  duration_hours: number;

  @ApiProperty({
    description: 'Percentage of total app usage time',
  })
  percent_of_total: number;

  @ApiProperty({
    description: 'Percentage change vs last week',
  })
  change_percent: number;
}

export class TopAppsDto {
  @ApiProperty({
    description: 'Total app usage hours in last 7 days',
  })
  total_usage_hours: number;

  @ApiProperty({
    description: 'Percentage increase from yesterday',
  })
  usage_increase_from_yesterday_percent: number;

  @ApiProperty({
    description: 'Top 5 apps by duration',
    isArray: true,
    type: AppUsageItemDto,
  })
  apps: AppUsageItemDto[];
}

export class LanguageSummaryDto {
  @ApiProperty({
    description: 'Total lines of code across all projects',
  })
  total_lines_of_code: number;

  @ApiProperty({
    description: 'Total code files across all projects',
  })
  total_files: number;

  @ApiProperty({
    description: 'Total unique languages used',
  })
  total_languages_used: number;
}

export class LanguageItemDto {
  @ApiProperty({
    description: 'Programming language name',
  })
  name: string;

  @ApiProperty({
    description: 'Percentage of total lines of code',
  })
  percent: number;

  @ApiProperty({
    description: 'Lines of code in this language',
  })
  loc: number;

  @ApiProperty({
    description: 'Number of files in this language',
  })
  files: number;
}

export class LanguageDistributionDto {
  @ApiProperty({
    description: 'Summary statistics',
    type: LanguageSummaryDto,
  })
  summary: LanguageSummaryDto;

  @ApiProperty({
    description: 'Top 5 languages by lines of code',
    isArray: true,
    type: LanguageItemDto,
  })
  languages: LanguageItemDto[];
}

export class ToolUsageResponseDto {
  @ApiProperty({
    description: 'Period type',
  })
  period: string;

  @ApiProperty({
    description: 'App usage statistics',
    type: TopAppsDto,
  })
  top_apps: TopAppsDto;

  @ApiProperty({
    description: 'Language distribution based on lines of code',
    type: LanguageDistributionDto,
  })
  language_distribution: LanguageDistributionDto;
}
