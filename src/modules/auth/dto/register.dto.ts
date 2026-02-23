import { IsEmail, IsString, IsBoolean, IsOptional } from 'class-validator';

export class RegisterUpdateDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsBoolean()
  @IsOptional()
  isVerified?: boolean;
}
