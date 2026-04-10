import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CloudinaryService } from '../auth/services/cloudinary.service';
import { User } from './schemas/user.schema';
import { RegisterUpdateDto } from '../auth/dto/register.dto';
import { PatchProfileDto } from './dto/patch-profile.dto';

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

  private normalizeOptionalUrl(raw: string | undefined): string | null {
    if (raw == null) {
      return null;
    }
    const t = raw.trim();
    if (t.length === 0) {
      return null;
    }
    try {
      const u = new URL(t);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        throw new Error('protocol');
      }
      return t.slice(0, 500);
    } catch {
      throw new BadRequestException('Invalid URL (use https://…)');
    }
  }

  async updateProfile(email: string, dto: PatchProfileDto) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (dto.name !== undefined) {
      user.name = dto.name.trim().slice(0, 200);
      if (!user.name) {
        throw new BadRequestException('Name cannot be empty');
      }
    }
    if (dto.description !== undefined) {
      user.description = dto.description.slice(0, 2000);
    }
    if (dto.github_url !== undefined) {
      user.github_url = this.normalizeOptionalUrl(dto.github_url);
    }
    if (dto.linkedin_url !== undefined) {
      user.linkedin_url = this.normalizeOptionalUrl(dto.linkedin_url);
    }
    if (dto.twitter_url !== undefined) {
      user.twitter_url = this.normalizeOptionalUrl(dto.twitter_url);
    }

    if (dto.profile_preferences !== undefined) {
      const prev = user.profile_preferences || {
        hidden_project_names: [],
        project_order: [],
        hidden_skill_names: [],
        hidden_app_names: [],
        hidden_language_names: [],
      };
      const p = dto.profile_preferences;
      user.profile_preferences = {
        hidden_project_names: p.hidden_project_names ?? prev.hidden_project_names,
        project_order: p.project_order ?? prev.project_order,
        hidden_skill_names: p.hidden_skill_names ?? prev.hidden_skill_names,
        hidden_app_names: p.hidden_app_names ?? prev.hidden_app_names,
        hidden_language_names: p.hidden_language_names ?? prev.hidden_language_names,
      };
    }

    if (dto.remove_profile_photo === true) {
      user.profilePhoto = null;
    }

    await user.save();
    return user;
  }

  async updateProfilePhoto(email: string, file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No image uploaded');
    }
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const url = await this.cloudinaryService.uploadImage(file, email);
    user.profilePhoto = url;
    await user.save();
    return user;
  }
}
