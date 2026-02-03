import { IsString, IsEmail, IsNumber, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsNumber()
  @IsOptional()
  age?: number;
}
