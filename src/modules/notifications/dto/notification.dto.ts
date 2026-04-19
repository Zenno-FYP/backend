import { IsString, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  token: string;

  @IsString()
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
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;
}
