import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAgentPreferencesDto {
  @ApiPropertyOptional({ enum: ['morning', 'standard', 'evening', 'night_owl'] })
  @IsOptional()
  @IsEnum(['morning', 'standard', 'evening', 'night_owl'])
  work_schedule?: string;

  @ApiPropertyOptional({ enum: ['deep', 'moderate', 'pomodoro'] })
  @IsOptional()
  @IsEnum(['deep', 'moderate', 'pomodoro'])
  focus_style?: string;

  @ApiPropertyOptional({ enum: ['focused', 'burnout', 'habits', 'minimal'] })
  @IsOptional()
  @IsEnum(['focused', 'burnout', 'habits', 'minimal'])
  wellbeing_goal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  nudge_enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notification_sound?: boolean;

  @ApiPropertyOptional({ enum: ['friendly', 'motivational', 'professional', 'casual'] })
  @IsOptional()
  @IsEnum(['friendly', 'motivational', 'professional', 'casual'])
  agent_tone?: string;
}
