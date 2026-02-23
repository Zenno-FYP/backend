import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { FirebaseModule } from '../../firebase/firebase.module';
import { CloudinaryService } from '../auth/services/cloudinary.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    FirebaseModule,
  ],
  controllers: [UserController],
  providers: [UserService, CloudinaryService],
  exports: [MongooseModule],
})
export class UserModule {}
