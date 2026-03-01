import {
  Controller,
  Post,
  UseGuards,
  Body,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
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
      'Batch sync endpoint (offline-first) that accepts a project bucket payload. Each project contains day buckets with aggregated metrics plus optional current LOC snapshots and project metadata.',
  })
  @ApiBody({
    description: 'Activity sync payload',
    type: SyncActivityDto,
    examples: {
      basic: {
        value: {
          user_id: '507f1f77bcf86cd799439011',
          sync_timestamp: '2026-03-01T14:30:00.123Z',
          data: [
            {
              project_name: 'desktop-agent',
              metadata: {
                first_seen_at: '2026-02-27T09:00:00Z',
                last_active_at: '2026-03-01T14:25:00Z',
              },
              current_loc: [
                { language: 'python', lines: 4500, files: 12 },
                { language: 'sql', lines: 150, files: 1 },
              ],
              days: [
                {
                  date: '2026-02-27',
                  languages: { python: 1200, sql: 300 },
                  apps: { vscode: 1400, chrome: 100 },
                  skills: { backend: 1000, debugging: 500 },
                  context: { focused: 1200, reading: 300 },
                  behavior: {
                    keystrokes: 5000,
                    clicks: 120,
                    scrolls: 50,
                    idle_sec: 100,
                  },
                },
                {
                  date: '2026-03-01',
                  languages: { python: 3600 },
                  apps: { vscode: 3500, terminal: 100 },
                  skills: { refactoring: 3600 },
                  context: { focused: 3600 },
                  behavior: {
                    keystrokes: 12000,
                    clicks: 400,
                    scrolls: 150,
                    idle_sec: 45,
                  },
                },
              ],
            },
            {
              project_name: 'zenno-web',
              metadata: {
                last_active_at: '2026-03-01T10:00:00Z',
              },
              current_loc: [
                { language: 'javascript', lines: 8000, files: 20 },
                { language: 'css', lines: 2000, files: 5 },
              ],
              days: [
                {
                  date: '2026-03-01',
                  languages: { javascript: 1800, css: 600 },
                  apps: { vscode: 2400 },
                  skills: { frontend: 2400 },
                  context: { focused: 2000, distracted: 400 },
                  behavior: {
                    keystrokes: 3000,
                    clicks: 800,
                    scrolls: 600,
                    idle_sec: 20,
                  },
                },
              ],
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Activity synced successfully',
    schema: {
      example: {
        success: true,
        message: 'Activity synced successfully',
        sync_timestamp: '2026-03-01T14:30:15.000Z',
        user: {
          id: '507f1f77bcf86cd799439011',
          email: 'user@example.com',
          name: 'John Doe',
          profile_photo: 'https://...',
          activity_sync_at: '2026-03-01T14:30:15.000Z',
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
