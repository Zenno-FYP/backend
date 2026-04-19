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
  Logger,
  InternalServerErrorException,
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
  ListNotificationsQueryDto,
} from './dto/notification.dto';

@Controller('api/v1/notifications')
@UseGuards(FirebaseAuthGuard)
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly notificationService: NotificationService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  /**
   * Resolve the Mongo `users._id` for the currently authenticated request.
   *
   * Memoizes the lookup on the request object itself so a single HTTP
   * request that calls multiple controller methods (or the same helper)
   * doesn't hit Mongo more than once for the same request.
   *
   * The `users` collection is keyed by email (the schema doesn't currently
   * store firebase_uid), so we look up by email and only return the `_id`
   * field — no need to load the whole document.
   */
  private async getUserId(req: any): Promise<Types.ObjectId> {
    if (req._zennoUserId instanceof Types.ObjectId) {
      return req._zennoUserId as Types.ObjectId;
    }
    const email: string | undefined = req.user?.email;
    if (!email) {
      throw new Error(
        `NotificationController: authenticated request had no email (uid=${req.user?.uid ?? '?'})`,
      );
    }
    const user = await this.userModel
      .findOne({ email })
      .select({ _id: 1 })
      .lean();
    if (!user) {
      throw new Error(
        `NotificationController: no user record for email=${email}`,
      );
    }
    const id = user._id as Types.ObjectId;
    req._zennoUserId = id;
    return id;
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
  async list(@Req() req: any, @Query() query: ListNotificationsQueryDto) {
    const userId = await this.getUserId(req);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.notificationService.listNotifications(userId, page, limit);
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

  /**
   * Self-test endpoint: fire a real FCM push to every device the
   * authenticated user has registered, plus drop a row into the
   * in-app notifications list. Surfaced from the mobile Settings
   * sheet so users (and us during QA) can verify push delivery
   * without having to wait on a peer to send a chat message.
   */
  @Post('test')
  async sendTest(@Req() req: any) {
    const userId = await this.getUserId(req);
    try {
      const result =
        await this.notificationService.sendTestNotification(userId);
      return { data: result };
    } catch (e: any) {
      // Surface the real cause to the server log instead of letting Nest
      // hide it behind a generic "Internal server error" — the test
      // endpoint is exactly where we need diagnostic clarity.
      this.logger.error(
        `sendTestNotification failed for user=${userId.toString()}: ${e?.message ?? e}`,
        e?.stack,
      );
      throw new InternalServerErrorException(
        e?.message ?? 'sendTestNotification failed',
      );
    }
  }
}
