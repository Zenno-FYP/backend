import { ApiProperty } from '@nestjs/swagger';

export class MetricValueDto {
  @ApiProperty({
    example: 8.6,
    description: 'The metric value',
  })
  value: number;

  @ApiProperty({
    example: 100,
    description: 'Percentage change compared to previous period',
  })
  change_percent: number;
}

export class PerformanceSummaryDto {
  @ApiProperty({
    description: 'Words per minute (keystrokes / 5) / active minutes',
    type: MetricValueDto,
  })
  wpm: MetricValueDto;

  @ApiProperty({
    description: 'Daily active average: total duration / count of active days',
    type: MetricValueDto,
  })
  daily_active_average: MetricValueDto;

  @ApiProperty({
    description: 'Total clicks sum',
    type: MetricValueDto,
  })
  total_clicks: MetricValueDto;

  @ApiProperty({
    description: 'Total scrolls sum',
    type: MetricValueDto,
  })
  total_scrolls: MetricValueDto;
}

export class UsageTrendBarDto {
  @ApiProperty({
    example: '2026-02-24',
    description: 'Date (YYYY-MM-DD)',
  })
  date: string;

  @ApiProperty({
    example: 'Tue',
    description: 'Day name (Mon, Tue, Wed, etc.)',
  })
  day_name: string;

  @ApiProperty({
    example: 4.5,
    description: 'Focused hours (coding, debugging, testing)',
    type: Number,
  })
  focused_hours: number;

  @ApiProperty({
    example: 1.5,
    description: 'Reading hours (research, documentation)',
    type: Number,
  })
  reading_hours: number;

  @ApiProperty({
    example: 0.5,
    description: 'Distracted hours (social media, communication, entertainment)',
    type: Number,
  })
  distracted_hours: number;

  @ApiProperty({
    example: 0.5,
    description: 'Idle hours',
    type: Number,
  })
  idle_hours: number;

  @ApiProperty({
    example: 7.0,
    description: 'Total active hours of the day',
    type: Number,
  })
  total_active_hours: number;
}

export class PerformanceMetricsResponseDto {
  @ApiProperty({
    example: 'last_7_days',
    description: 'Period type',
  })
  period: string;

  @ApiProperty({
    example: '2026-03-02T14:30:00Z',
    description: 'Timestamp when metrics were calculated',
  })
  sync_timestamp: string;

  @ApiProperty({
    description: 'Performance summary metrics with trends',
    type: PerformanceSummaryDto,
  })
  performance_summary: PerformanceSummaryDto;

  @ApiProperty({
    description: 'Daily breakdown for stacked bar chart (7 days)',
    isArray: true,
    type: UsageTrendBarDto,
  })
  usage_trend_graph: UsageTrendBarDto[];
}
