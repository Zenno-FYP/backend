import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProfilePageResponseDto } from './profile-page.dto';

export class PublicProfileUserDto {
  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true, description: 'Public profile image URL' })
  profilePhoto: string | null;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional({ nullable: true })
  github_url: string | null;

  @ApiPropertyOptional({ nullable: true })
  linkedin_url: string | null;

  @ApiPropertyOptional({ nullable: true })
  twitter_url: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'ISO 8601' })
  createdAt: string | null;
}

export class PublicProfileResponseDto {
  @ApiProperty({ type: PublicProfileUserDto })
  user: PublicProfileUserDto;

  @ApiProperty({ type: ProfilePageResponseDto })
  profile: ProfilePageResponseDto;
}
