import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CloudinaryService } from './services/cloudinary.service';
import { FirebaseModule } from '../../firebase/firebase.module';
import { UserModule } from '../user/user.module';
import { TokenBlacklist, TokenBlacklistSchema } from './schemas/token-blacklist.schema';

@Module({
  imports: [
    UserModule,
    FirebaseModule,
    MongooseModule.forFeature([{ name: TokenBlacklist.name, schema: TokenBlacklistSchema }]),
  ],
  controllers: [AuthController],
  providers: [AuthService, CloudinaryService],
  exports: [AuthService],
})
export class AuthModule {}
