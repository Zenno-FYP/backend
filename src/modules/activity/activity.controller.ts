import {
  Controller,
  Post,
  Get,
  UseGuards,
  Body,
  Query,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { SyncActivityDto } from './dto/sync-activity.dto';

@ApiTags('Activity/Sync')
@Controller('api/v1/sync')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post('activity')
  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({
    summary: 'Sync activity data from desktop agent',
    description:
      'Comprehensive sync endpoint that accepts all activity metrics (languages, apps, skills, context, behavior, LOC snapshots) in a single atomic transaction',
  })
  @ApiResponse({
    status: 201,
    description: 'Activity synced successfully',
    schema: {
      example: {
        success: true,
        message: 'Activity synced successfully',
        sync_timestamp: '2026-02-28T15:30:00.000Z',
        user: {
          id: '507f1f77bcf86cd799439011',
          email: 'user@example.com',
          name: 'John Doe',
          profile_photo: 'https://...',
          activity_sync_at: '2026-02-28T15:30:00.000Z',
          stats: {
            total_activity_records: 45,
            total_projects: 5,
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request data or sync failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid firebase token' })
  async syncActivity(
    @Body() syncDto: SyncActivityDto,
    @Request() req: any,
  ) {
    return await this.activityService.syncActivity(req.user.email, syncDto);
  }
}
