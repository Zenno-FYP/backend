import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { User } from '../user/schemas/user.schema';
import { NotificationService } from './notification.service';
import {
  RegisterDeviceDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification.dto';

@Controller('notifications')
@UseGuards(FirebaseAuthGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  private async getUserId(req: any): Promise<Types.ObjectId> {
    const email = req.user?.email;
    const user = await this.userModel.findOne({ email });
    return user!._id as Types.ObjectId;
  }

  @Post('devices')
  async registerDevice(@Req() req: any, @Body() dto: RegisterDeviceDto) {
    const userId = await this.getUserId(req);
    await this.notificationService.registerDevice(
      userId,
      dto.token,
      dto.platform,
      dto.device_label ?? '',
    );
    return { success: true };
  }

  @Delete('devices/:token')
  async unregisterDevice(@Req() req: any, @Param('token') token: string) {
    const userId = await this.getUserId(req);
    await this.notificationService.unregisterDevice(userId, token);
    return { success: true };
  }

  @Get()
  async list(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = await this.getUserId(req);
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.notificationService.listNotifications(userId, p, l);
  }

  @Get('unread-count')
  async unreadCount(@Req() req: any) {
    const userId = await this.getUserId(req);
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Post(':id/read')
  async markRead(@Req() req: any, @Param('id') id: string) {
    const userId = await this.getUserId(req);
    await this.notificationService.markRead(userId, id);
    return { success: true };
  }

  @Post('read-all')
  async markAllRead(@Req() req: any) {
    const userId = await this.getUserId(req);
    await this.notificationService.markAllRead(userId);
    return { success: true };
  }

  @Get('preferences')
  async getPreferences(@Req() req: any) {
    const userId = await this.getUserId(req);
    const prefs = await this.notificationService.getPreferences(userId);
    return { data: prefs };
  }

  @Put('preferences')
  async updatePreferences(
    @Req() req: any,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    const userId = await this.getUserId(req);
    const prefs = await this.notificationService.updatePreferences(userId, dto);
    return { data: prefs };
  }
}
