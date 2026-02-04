import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { FirebaseModule } from './firebase/firebase.module';

const logger = new Logger('AppModule');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    AuthModule,
  ],
})
export class AppModule {}
