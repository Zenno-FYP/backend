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

  async getUser(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  async updateUser(
    email: string,
    updateDto: RegisterUpdateDto,
    file?: Express.Multer.File,
  ) {
    try {
      // Upload profile photo to Cloudinary if provided
      let profilePhotoUrl = null;
      if (file) {
        profilePhotoUrl = await this.cloudinaryService.uploadImage(file, email);
      }

      // Find or create user
      let user = await this.userModel.findOne({ email });

      if (!user) {
        // Create new user
        user = new this.userModel({
          email,
          name: updateDto.name,
          profilePhoto: profilePhotoUrl,
          isVerified: updateDto.isVerified || false,
          role: 'user',
        });
      } else {
        // Update existing user
        user.name = updateDto.name;
        user.isVerified = updateDto.isVerified ?? user.isVerified;
        if (profilePhotoUrl) {
          user.profilePhoto = profilePhotoUrl;
        }
      }

      await user.save();
      return user;
    } catch (error) {
      throw new BadRequestException('Failed to update user: ' + error.message);
    }
  }
}
