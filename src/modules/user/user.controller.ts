import { Controller, Get, Put, UseGuards, Body, UploadedFile, UseInterceptors, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UserService } from './user.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RegisterUpdateDto } from '../auth/dto/register.dto';

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
    const user = await this.userService.getUser(req.user.email);
    return {
      success: true,
      message: 'User details retrieved',
      data: user,
    };
  }

  @Put('me')
  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard)
  @UseInterceptors(FileInterceptor('profilePhoto'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update/create current user profile' })
  @ApiBody({
    description: 'User profile update data with optional profile photo',
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
        isVerified: {
          type: 'boolean',
          example: true,
          description: 'Is user verified (optional)',
        },
        profilePhoto: {
          type: 'string',
          format: 'binary',
          description: 'Profile photo file (optional)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'User profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid firebase token' })
  async updateMe(
    @Body() updateDto: RegisterUpdateDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    const user = await this.userService.updateUser(req.user.email, updateDto, file);
    return {
      success: true,
      message: 'User profile updated successfully',
      data: user,
    };
  }
}
