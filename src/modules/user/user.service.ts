import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CloudinaryService } from '../auth/services/cloudinary.service';
import { User } from './schemas/user.schema';
import { RegisterUpdateDto } from '../auth/dto/register.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async getUser(email: string, firebaseEmailVerified?: boolean) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Auto-sync Firebase email verification status with MongoDB
    if (firebaseEmailVerified && !user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    return user;
  }

  async createOrGetUser(
    email: string,
    createDto: RegisterUpdateDto,
    file?: Express.Multer.File,
    firebaseEmailVerified?: boolean,
  ) {
    try {
      // Check if user already exists
      let user = await this.userModel.findOne({ email });

      if (user) {
        // User already exists - auto-sync Firebase email verification status only
        if (firebaseEmailVerified && !user.isVerified) {
          user.isVerified = true;
          await user.save();
        }
        return user;
      }

      // User doesn't exist - create new user
      let profilePhotoUrl = null;
      if (file) {
        profilePhotoUrl = await this.cloudinaryService.uploadImage(file, email);
      }

      user = new this.userModel({
        email,
        name: createDto.name,
        profilePhoto: profilePhotoUrl,
        isVerified: firebaseEmailVerified || false,
        role: 'user',
      });

      await user.save();
      return user;
    } catch (error) {
      throw new BadRequestException('Failed to create user: ' + error.message);
    }
  }
}
