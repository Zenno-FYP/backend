import { ApiProperty } from '@nestjs/swagger';
import { LanguageDistributionDto, TopAppsDto } from './tool-usage.dto';

export class DailyAppUsageDto {
  @ApiProperty({ description: 'Calendar date (YYYY-MM-DD, UTC)' })
  date: string;

  @ApiProperty({ description: 'Short weekday label' })
  day_name: string;

  @ApiProperty({ description: 'Sum of all app usage hours that day (all projects)' })
  total_hours: number;
}

export class AppCategoryUsageDto {
  @ApiProperty({ example: 'Development' })
  category: string;

  @ApiProperty({ description: 'Hours in last 7 days attributed to this category' })
  hours: number;

  @ApiProperty({ description: 'Share of total app time (0–100)' })
  percent_of_total: number;
}

export class ToolUsageDetailResponseDto {
  @ApiProperty({ description: 'Period key', example: 'week' })
  period: string;

  @ApiProperty({ description: 'Distinct apps with any usage in the window' })
  unique_apps_count: number;

  @ApiProperty({ description: 'Change vs prior equivalent window (0–100 scale, can be negative)' })
  vs_prior_period_percent: number;

  @ApiProperty({
    description:
      'App time grouped by inferred category (name-based rules; see app-category.mapper.ts)',
    type: [AppCategoryUsageDto],
  })
  category_breakdown: AppCategoryUsageDto[];

  @ApiProperty({ description: 'Grouped app hours bars (day/week/month depending on period)', type: [DailyAppUsageDto] })
  daily_app_usage: DailyAppUsageDto[];

  @ApiProperty({ description: 'Top apps with usage stats (detail list)', type: TopAppsDto })
  top_apps: TopAppsDto;

  @ApiProperty({ description: 'Language distribution from project LOC (all-time)', type: LanguageDistributionDto })
  language_distribution: LanguageDistributionDto;
}
