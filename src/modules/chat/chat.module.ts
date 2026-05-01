import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FirebaseModule } from '../../firebase/firebase.module';
import { User, UserSchema } from '../user/schemas/user.schema';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { ChatReport, ChatReportSchema } from './schemas/chat-report.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: ChatReport.name, schema: ChatReportSchema },
    ]),
    FirebaseModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, MongooseModule],
})
export class ChatModule {}
