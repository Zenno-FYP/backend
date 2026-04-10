import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ProfilePreferencesPatchDto {
  @ApiPropertyOptional({ type: [String], description: 'Project sync names hidden on profile' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hidden_project_names?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Preferred order of project_name values on profile (all known projects should be listed)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  project_order?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hidden_skill_names?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hidden_app_names?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hidden_language_names?: string[];
}

export class PatchProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Short bio shown on profile' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  github_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkedin_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  twitter_url?: string;

  @ApiPropertyOptional({ type: ProfilePreferencesPatchDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfilePreferencesPatchDto)
  profile_preferences?: ProfilePreferencesPatchDto;

  @ApiPropertyOptional({ description: 'Clear stored profile photo URL' })
  @IsOptional()
  @IsBoolean()
  remove_profile_photo?: boolean;
}
