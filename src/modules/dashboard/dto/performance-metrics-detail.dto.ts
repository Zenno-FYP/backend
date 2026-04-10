import { ApiProperty } from '@nestjs/swagger';
import { PerformanceSummaryDto } from './dashboard-metrics.dto';

export class DailyBehaviorMetricsDto {
  @ApiProperty({ example: '2026-04-09' })
  date: string;

  @ApiProperty({ example: 'Wed' })
  day_name: string;

  @ApiProperty({
    description: 'Average typing intensity (KPM) across project rows for this day',
  })
  typing_intensity_kpm: number;

  @ApiProperty({
    description: 'Average mouse click rate (CPM) across project rows for this day',
  })
  mouse_click_rate_cpm: number;

  @ApiProperty({
    description: 'Correction rate % for this day (deletions / estimated keystrokes × 100)',
  })
  correction_rate_percent: number;

  @ApiProperty({ description: 'Sum of context durations for the day, in hours' })
  active_hours: number;

  @ApiProperty({ description: 'Sum of idle seconds for the day, in hours' })
  idle_hours: number;

  @ApiProperty()
  total_deletion_key_presses: number;

  @ApiProperty()
  total_mouse_movement_distance: number;
}

export class PerformanceMetricsDetailResponseDto {
  @ApiProperty({ example: 'last_7_days' })
  period: string;

  @ApiProperty({ type: PerformanceSummaryDto })
  performance_summary: PerformanceSummaryDto;

  @ApiProperty({ type: [DailyBehaviorMetricsDto] })
  daily_series: DailyBehaviorMetricsDto[];
}
