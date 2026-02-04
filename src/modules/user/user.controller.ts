import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api/v1/user')
@ApiTags('User')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiBearerAuth('access-token')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: any) {
    const profile = await this.userService.getUserProfile(user.uid);
    return {
      success: true,
      message: 'User profile retrieved',
      data: profile,
    };
  }
}
