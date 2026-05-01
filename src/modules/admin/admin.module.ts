import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { FirebaseModule } from '../../firebase/firebase.module';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AdminController } from './admin.controller';
import { AdminStatsService } from './admin-stats.service';
import { AdminUsersService } from './admin-users.service';
import { AdminChatReportsService } from './admin-chat-reports.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';

@Module({
  imports: [ChatModule, FirebaseModule],
  controllers: [AdminController],
  providers: [
    FirebaseAuthGuard,
    AdminStatsService,
    AdminUsersService,
    AdminChatReportsService,
    AdminAuthGuard,
  ],
})
export class AdminModule {}
