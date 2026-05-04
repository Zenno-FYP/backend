import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'FCM registration token' })
  @IsString()
  token: string;

  // Backend currently treats every platform identically, but we still
  // restrict the value so callers can't smuggle in arbitrary strings.
  @ApiProperty({ enum: ['web', 'android', 'ios'] })
  @IsIn(['web', 'android', 'ios'])
  platform: 'web' | 'android' | 'ios';

  @ApiPropertyOptional({ description: 'Human-readable label (e.g. device model)' })
  @IsString()
  @IsOptional()
  device_label?: string;
}

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  push_enabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  chat_enabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  new_project_enabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  daily_digest_enabled?: boolean;
}

export class ListNotificationsQueryDto {
  // `Type(() => Number)` lets the global ValidationPipe coerce the
  // querystring value (always a string) into an int before @IsInt runs.
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;
}
