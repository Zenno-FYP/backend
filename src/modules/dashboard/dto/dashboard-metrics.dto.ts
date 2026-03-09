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
    description: 'Average typing intensity (keystrokes per minute)',
    type: MetricValueDto,
  })
  avg_typing_intensity: MetricValueDto;

  @ApiProperty({
    description: 'Average mouse click rate (clicks per minute)',
    type: MetricValueDto,
  })
  avg_mouse_click_rate: MetricValueDto;

  @ApiProperty({
    description: 'Average corrections per active day (deletion/backspace key presses)',
    type: MetricValueDto,
  })
  avg_corrections: MetricValueDto;

  @ApiProperty({
    description: 'Daily active average: total duration / count of active days',
    type: MetricValueDto,
  })
  daily_active_average: MetricValueDto;
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
    description: 'Flow hours (deep focus, coding work)',
    type: Number,
  })
  flow_hours: number;

  @ApiProperty({
    example: 1.5,
    description: 'Debugging hours (debugging and fixing code)',
    type: Number,
  })
  debugging_hours: number;

  @ApiProperty({
    example: 2.0,
    description: 'Research hours (research, documentation, learning)',
    type: Number,
  })
  research_hours: number;

  @ApiProperty({
    example: 0.5,
    description: 'Communication hours (meetings, chat, collaboration)',
    type: Number,
  })
  communication_hours: number;

  @ApiProperty({
    example: 0.3,
    description: 'Distracted hours (distracted, off-task)',
    type: Number,
  })
  distracted_hours: number;
}

export class PerformanceMetricsResponseDto {
  @ApiProperty({
    example: 'last_7_days',
    description: 'Period type',
  })
  period: string;

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
