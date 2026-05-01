import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReportConversationDto {
  @ApiPropertyOptional({ maxLength: 500, description: 'Optional moderation context from the reporter' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
