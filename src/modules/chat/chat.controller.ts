import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { ChatService } from './chat.service';
import {
  ConversationsListResponseDto,
  MessagesListResponseDto,
  OpenConversationDto,
  OpenConversationResponseDto,
} from './dto/chat-rest.dto';
import { ReportConversationDto } from './dto/report-conversation.dto';

@ApiTags('Chat')
@Controller('api/v1/chat')
@ApiBearerAuth('firebase')
@UseGuards(FirebaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations (inbox)' })
  @ApiResponse({ status: 200, description: 'Conversation summaries with unread counts' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Firebase token' })
  async listConversations(@Request() req: any): Promise<ConversationsListResponseDto> {
    const conversations = await this.chatService.listConversations(req.user.email);
    return { conversations };
  }

  @Post('conversations/:conversationId/report')
  @ApiOperation({
    summary: 'Report a conversation for moderation review',
    description:
      'Creates a ChatReport if the caller is a participant. Duplicate open reports from the same reporter return 409.',
  })
  @ApiResponse({ status: 201, description: 'Report created' })
  @ApiResponse({ status: 400, description: 'Invalid conversation id' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Firebase token' })
  @ApiResponse({ status: 403, description: 'Caller is not a participant in this conversation' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 409, description: 'Duplicate open report for this reporter + conversation' })
  async reportConversation(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Body() dto: ReportConversationDto,
  ): Promise<{ report_id: string }> {
    return this.chatService.reportConversation(req.user.email, conversationId, dto.reason);
  }

  @Post('conversations/with-user')
  @ApiOperation({ summary: 'Get or create a 1:1 conversation with another user' })
  @ApiResponse({ status: 200, description: 'Conversation id' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Firebase token' })
  @ApiResponse({ status: 404, description: 'Peer user not found' })
  async openWithUser(
    @Request() req: any,
    @Body() dto: OpenConversationDto,
  ): Promise<OpenConversationResponseDto> {
    return this.chatService.openConversation(req.user.email, dto.userId);
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Load messages (newest page); use before=cursor for older' })
  @ApiResponse({ status: 200, description: 'Messages oldest-first in page' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Firebase token' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getMessages(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Query('before') before?: string,
    @Query('limit') limitStr?: string,
  ): Promise<MessagesListResponseDto> {
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const messages = await this.chatService.getMessages(req.user.email, conversationId, before, limit);
    return { messages };
  }

  @Post('conversations/:conversationId/read')
  @ApiOperation({ summary: 'Mark incoming messages in this conversation as read' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Firebase token' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async markRead(@Request() req: any, @Param('conversationId') conversationId: string): Promise<{ ok: true }> {
    await this.chatService.markRead(req.user.email, conversationId);
    return { ok: true };
  }
}
