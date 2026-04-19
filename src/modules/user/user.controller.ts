import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  UseGuards,
  Body,
  UploadedFile,
  UseInterceptors,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UserService } from './user.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AllowUnverified } from '../auth/decorators/allow-unverified.decorator';
import { RegisterUpdateDto } from '../auth/dto/register.dto';
import { PatchProfileDto } from './dto/patch-profile.dto';

@ApiTags('User')
@Controller('api/v1/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Get current user details' })
  @ApiResponse({ status: 200, description: 'User details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid firebase token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getMe(@Request() req: any) {
    const user = await this.userService.getUser(req.user.email, req.user.email_verified);
    return {
      success: true,
      message: 'User details retrieved',
      data: user,
    };
  }

  @Put('me')
  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard)
  @AllowUnverified()
  @UseInterceptors(FileInterceptor('profilePhoto'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create current user profile (first time only)' })
  @ApiBody({
    description: 'User profile creation data with optional profile photo',
    schema: {
      type: 'object',
      required: ['email', 'name'],
      properties: {
        email: {
          type: 'string',
          example: 'user@example.com',
          description: 'User email address',
        },
        name: {
          type: 'string',
          example: 'John Doe',
          description: 'User full name',
        },
        profilePhoto: {
          type: 'string',
          format: 'binary',
          description: 'Profile photo file (optional)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'User profile created successfully (new user)' })
  @ApiResponse({ status: 200, description: 'User profile already exists (returning existing user)' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid firebase token' })
  async createMe(
    @Body() createDto: RegisterUpdateDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    const user = await this.userService.createOrGetUser(req.user.email, createDto, file, req.user.email_verified);
    return {
      success: true,
      message: 'User profile created successfully',
      data: user,
    };
  }

  @Patch('me')
  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Update profile (name, bio, social links, display preferences)' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async patchMe(@Request() req: any, @Body() dto: PatchProfileDto) {
    const user = await this.userService.updateProfile(req.user.email, dto);
    return {
      success: true,
      message: 'Profile updated',
      data: user,
    };
  }

  @Post('me/profile-photo')
  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard)
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload or replace profile picture' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['profilePhoto'],
      properties: {
        profilePhoto: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Photo updated' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadProfilePhoto(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('profilePhoto file is required');
    }
    const user = await this.userService.updateProfilePhoto(req.user.email, file);
    return {
      success: true,
      message: 'Profile photo updated',
      data: user,
    };
  }
}
