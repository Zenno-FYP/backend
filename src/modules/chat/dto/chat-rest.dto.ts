import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class OpenConversationDto {
  @ApiProperty({ description: 'MongoDB ObjectId of the other user' })
  @IsMongoId()
  userId: string;
}

export class ChatMessageItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sender_id: string;

  @ApiProperty()
  body: string;

  @ApiProperty()
  created_at: string;

  @ApiPropertyOptional({ nullable: true })
  read_at: string | null;
}

export class ConversationSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  other_user: {
    id: string;
    name: string;
    profilePhoto: string | null;
  };

  @ApiProperty()
  last_message_text: string;

  @ApiProperty()
  last_message_at: string;

  @ApiProperty()
  unread_count: number;
}

export class ConversationsListResponseDto {
  @ApiProperty({ type: [ConversationSummaryDto] })
  conversations: ConversationSummaryDto[];
}

export class MessagesListResponseDto {
  @ApiProperty({ type: [ChatMessageItemDto] })
  messages: ChatMessageItemDto[];
}

export class OpenConversationResponseDto {
  @ApiProperty()
  conversation_id: string;
}

export class SendMessageWsDto {
  @IsMongoId()
  recipientUserId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text: string;
}

export class MarkReadWsDto {
  @IsMongoId()
  conversationId: string;
}
