import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './modules/user/user.module';
import { FirebaseModule } from './firebase/firebase.module';
import { ActivityModule } from './modules/activity/activity.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ChatModule } from './modules/chat/chat.module';
import { AgentModule } from './modules/agent/agent.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

const logger = new Logger('AppModule');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load the env file that matches the current NODE_ENV, then fall back to
      // the plain `.env` so local dev keeps working without any changes.
      // Priority (highest first): process env → .env.production / .env → defaults.
      envFilePath: [
        `.env.${process.env.NODE_ENV ?? 'development'}`,
        '.env',
      ],
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forRoot(
      process.env.MONGODB_URI!,
      {
        connectionFactory: (connection) => {
          connection.on('connected', () => {
            logger.log('MongoDB connected successfully');
          });
          connection.on('error', (err: any) => {
            logger.error('MongoDB connection error:', err);
          });
          return connection;
        },
      },
    ),
    FirebaseModule,
    UserModule,
    ActivityModule,
    DashboardModule,
    ChatModule,
    AgentModule,
    NotificationsModule,
  ],
})
export class AppModule {}
