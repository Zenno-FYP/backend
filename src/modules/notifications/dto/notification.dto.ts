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

export class RegisterDeviceDto {
  @IsString()
  token: string;

  // Backend currently treats every platform identically, but we still
  // restrict the value so callers can't smuggle in arbitrary strings.
  @IsIn(['web', 'android'])
  platform: 'web' | 'android';

  @IsString()
  @IsOptional()
  device_label?: string;
}

export class UpdateNotificationPreferencesDto {
  @IsBoolean()
  @IsOptional()
  push_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  chat_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  new_project_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  daily_digest_enabled?: boolean;
}

export class ListNotificationsQueryDto {
  // `Type(() => Number)` lets the global ValidationPipe coerce the
  // querystring value (always a string) into an int before @IsInt runs.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;
}
