import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PeerCardDto {
  @ApiProperty()
  user_id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  profile_photo_url: string | null;

  @ApiProperty({ description: 'Short public bio from profile' })
  bio: string;

  @ApiProperty({ type: [String], description: 'Sample skill names from synced projects' })
  top_skills: string[];

  @ApiProperty({ type: [String], description: 'Project sync or display names' })
  top_projects: string[];

  @ApiProperty({ type: [String], description: 'App names seen in activity.apps' })
  top_apps: string[];
}

export class PeersSearchResponseDto {
  @ApiProperty({ type: [PeerCardDto] })
  peers: PeerCardDto[];
}
