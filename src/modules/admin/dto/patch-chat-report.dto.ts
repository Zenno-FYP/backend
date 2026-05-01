import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PatchChatReportDto {
  @ApiProperty({ enum: ['open', 'dismissed', 'reviewed', 'action_taken'] })
  @IsEnum(['open', 'dismissed', 'reviewed', 'action_taken'])
  status!: 'open' | 'dismissed' | 'reviewed' | 'action_taken';

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  admin_note?: string;
}
