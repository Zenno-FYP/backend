import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getUserProfile(uid: string) {
    const user = await this.userModel.findOne({ uid });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }
}
