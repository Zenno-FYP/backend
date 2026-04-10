import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Model } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { FirebaseService } from '../../firebase/firebase.service';
import { User } from '../user/schemas/user.schema';
import { ChatService } from './chat.service';
import { MarkReadWsDto, SendMessageWsDto } from './dto/chat-rest.dto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { parseCorsOrigins } from '../../common/cors-origins';

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: parseCorsOrigins(), credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly firebaseService: FirebaseService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth && (client.handshake.auth as { token?: string }).token) ||
      (client.handshake.query?.token as string) ||
      '';
    if (!token || typeof token !== 'string') {
      this.logger.warn('Chat socket: missing token');
      client.disconnect(true);
      return;
    }
    try {
      const decoded = await this.firebaseService.verifyToken(token);
      const email = decoded.email;
      if (!email) {
        client.disconnect(true);
        return;
      }
      const user = await this.userModel.findOne({ email });
      if (!user) {
        client.disconnect(true);
        return;
      }
      const mongoUserId = user._id.toString();
      (client.data as { mongoUserId?: string; email?: string }).mongoUserId = mongoUserId;
      (client.data as { mongoUserId?: string; email?: string }).email = email;
      await client.join(`user:${mongoUserId}`);
      this.logger.log(`Chat connected user:${mongoUserId}`);
    } catch (e) {
      this.logger.warn(`Chat socket auth failed: ${e}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket, ...args: unknown[]) {
    const id = (client.data as { mongoUserId?: string }).mongoUserId;
    if (id) {
      this.logger.log(`Chat disconnected user:${id} reason=${args[0] ?? 'unknown'}`);
    }
  }

  @SubscribeMessage('send_message')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean; message?: unknown; error?: string }> {
    const email = (client.data as { email?: string }).email;
    if (!email) {
      throw new WsException('Unauthorized');
    }
    const dto = plainToInstance(SendMessageWsDto, raw);
    const errors = validateSync(dto);
    if (errors.length) {
      throw new WsException('Invalid payload');
    }
    try {
      const saved = await this.chatService.sendTextMessage(email, dto.recipientUserId, dto.text);
      const payload = {
        conversation_id: saved.conversationId,
        message: saved.message,
      };
      this.server.to(`user:${saved.recipientMongoId}`).emit('chat:new_message', payload);
      this.server.to(`user:${(client.data as { mongoUserId: string }).mongoUserId}`).emit('chat:new_message', payload);
      return { ok: true, message: saved.message };
    } catch (e: any) {
      const msg = e?.response?.message || e?.message || 'Send failed';
      return { ok: false, error: Array.isArray(msg) ? msg.join(', ') : String(msg) };
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(@ConnectedSocket() client: Socket, @MessageBody() raw: unknown): Promise<{ ok: boolean }> {
    const mongoUserId = (client.data as { mongoUserId?: string }).mongoUserId;
    if (!mongoUserId) {
      throw new WsException('Unauthorized');
    }
    const dto = plainToInstance(MarkReadWsDto, raw);
    const errors = validateSync(dto);
    if (errors.length) {
      throw new WsException('Invalid payload');
    }
    await this.chatService.markReadByUserId(mongoUserId, dto.conversationId);
    return { ok: true };
  }
}
