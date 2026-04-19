import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NudgeRecordItemDto {
  @ApiProperty({ description: 'ISO 8601 timestamp from the desktop agent clock' })
  @IsDateString()
  generated_at: string;

  @ApiProperty()
  @IsString()
  nudge_type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nudge_text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  was_suppressed?: boolean;

  /**
   * When `was_suppressed === true`, the desktop agent records why
   * (e.g. `quiet_hours`, `aggregation_failed`, `display_failed`).
   * Surfaced in the website's Zenno Agent stats.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  suppression_reason?: string;
}

export class SyncNudgesDto {
  @ApiProperty({ type: [NudgeRecordItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NudgeRecordItemDto)
  records: NudgeRecordItemDto[];
}
