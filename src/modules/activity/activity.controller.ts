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
      'Batch sync endpoint (offline-first) that accepts a project bucket payload. Each project contains day buckets with aggregated metrics, optional current LOC snapshots, cumulative project skills, and project metadata.',
  })
  @ApiBody({
    description: 'Activity sync payload',
    type: SyncActivityDto,
    examples: {
      basic: {
        value: {
          user_id: '69a42556794075b5083150b0',
          sync_timestamp: '2026-03-01T14:30:45',
          data: [
            {
              project_name: 'desktop-agent',
              metadata: {
                first_seen_at: '2026-02-27T09:00:00',
                last_active_at: '2026-03-01T14:30:00',
              },
              current_loc: [
                { language: 'python', lines: 4500, files: 12 },
                { language: 'sql', lines: 800, files: 3 },
              ],
              project_skills: [
                { skill_name: 'backend', duration_sec: 5400 },
                { skill_name: 'database', duration_sec: 1800 },
              ],
              days: [
                {
                  date: '2026-02-27',
                  languages: { python: 1200, sql: 300 },
                  apps: { vscode: 1400 },
                  context: { coding: 1400 },
                  behavior: {
                    keystrokes: 2500,
                    clicks: 150,
                    scrolls: 80,
                    idle_sec: 200,
                  },
                },
                {
                  date: '2026-02-28',
                  languages: { python: 1500 },
                  apps: { vscode: 1600 },
                  context: { coding: 1600 },
                  behavior: {
                    keystrokes: 3000,
                    clicks: 200,
                    scrolls: 100,
                    idle_sec: 150,
                  },
                },
                {
                  date: '2026-03-01',
                  languages: { python: 800, sql: 200 },
                  apps: { vscode: 900 },
                  context: { coding: 900 },
                  behavior: {
                    keystrokes: 1800,
                    clicks: 120,
                    scrolls: 60,
                    idle_sec: 300,
                  },
                },
              ],
            },
            {
              project_name: 'backend-api',
              metadata: {
                first_seen_at: '2026-02-28T10:30:00',
                last_active_at: '2026-03-01T13:45:00',
              },
              current_loc: [
                { language: 'typescript', lines: 3200, files: 8 },
                { language: 'javascript', lines: 600, files: 4 },
              ],
              project_skills: [
                { skill_name: 'typescript', duration_sec: 7200 },
                { skill_name: 'nestjs', duration_sec: 5400 },
                { skill_name: 'rest-api', duration_sec: 3600 },
              ],
              days: [
                {
                  date: '2026-02-28',
                  languages: { typescript: 2000, javascript: 400 },
                  apps: { vscode: 2300, postman: 200 },
                  context: { coding: 2400 },
                  behavior: {
                    keystrokes: 4200,
                    clicks: 350,
                    scrolls: 150,
                    idle_sec: 100,
                  },
                },
                {
                  date: '2026-03-01',
                  languages: { typescript: 1200, javascript: 200 },
                  apps: { vscode: 1100, postman: 300 },
                  context: { coding: 1300 },
                  behavior: {
                    keystrokes: 2500,
                    clicks: 200,
                    scrolls: 85,
                    idle_sec: 250,
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
