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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

@ApiTags('Notifications')
@ApiBearerAuth('firebase')
@Controller('api/v1/notifications')
@UseGuards(FirebaseAuthGuard)
export class NotificationController {
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
  @ApiOperation({
    summary: 'Register FCM device token',
    description:
      'Upserts a device row for push delivery. `platform` is `web` or `android`. Same token for another user is reassigned.',
  })
  @ApiBody({ type: RegisterDeviceDto })
  @ApiResponse({ status: 201, description: '{ success: true }' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
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
  @ApiOperation({ summary: 'Remove FCM device token for current user' })
  @ApiParam({
    name: 'token',
    description: 'Raw FCM registration token (URL-encoded if it contains special characters)',
  })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  async unregisterDevice(@Req() req: any, @Param('token') token: string) {
    const userId = await this.getUserId(req);
    await this.notificationService.unregisterDevice(userId, token);
    return { success: true };
  }

  @Get()
  @ApiOperation({
    summary: 'List in-app notifications',
    description: 'Paginated inbox for the current user (newest first). Default page=1, limit=20, max limit=50.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Paginated notifications (shape from NotificationService.listNotifications)',
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  async list(@Req() req: any, @Query() query: ListNotificationsQueryDto) {
    const userId = await this.getUserId(req);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.notificationService.listNotifications(userId, page, limit);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count' })
  @ApiResponse({ status: 200, description: '{ count: number }' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  async unreadCount(@Req() req: any) {
    const userId = await this.getUserId(req);
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiParam({ name: 'id', description: 'Notification document id' })
  @ApiResponse({ status: 201, description: '{ success: true }' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  async markRead(@Req() req: any, @Param('id') id: string) {
    const userId = await this.getUserId(req);
    await this.notificationService.markRead(userId, id);
    return { success: true };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 201, description: '{ success: true }' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  async markAllRead(@Req() req: any) {
    const userId = await this.getUserId(req);
    await this.notificationService.markAllRead(userId);
    return { success: true };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification channel preferences' })
  @ApiResponse({
    status: 200,
    description: '{ data: NotificationPreferences } — push/chat/digest toggles',
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  async getPreferences(@Req() req: any) {
    const userId = await this.getUserId(req);
    const prefs = await this.notificationService.getPreferences(userId);
    return { data: prefs };
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification channel preferences' })
  @ApiBody({ type: UpdateNotificationPreferencesDto })
  @ApiResponse({ status: 200, description: '{ data: updated preferences }' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  async updatePreferences(
    @Req() req: any,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    const userId = await this.getUserId(req);
    const prefs = await this.notificationService.updatePreferences(userId, dto);
    return { data: prefs };
  }
}
