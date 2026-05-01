import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminStatsService } from './admin-stats.service';
import { AdminUsersService } from './admin-users.service';
import { AdminChatReportsService } from './admin-chat-reports.service';
import { PatchChatReportDto } from './dto/patch-chat-report.dto';
import type { ChatReportStatus } from '../chat/schemas/chat-report.schema';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';

@ApiTags('Admin')
@ApiBearerAuth('firebase')
@Controller('api/v1/admin')
export class AdminController {
  constructor(
    private readonly statsService: AdminStatsService,
    private readonly users: AdminUsersService,
    private readonly reports: AdminChatReportsService,
  ) {}

  @Get('stats')
  @UseGuards(FirebaseAuthGuard, AdminAuthGuard)
  @ApiOperation({
    summary: 'Dashboard aggregate stats',
    description:
      'Counts users (total, verified, unverified), desktop-active in last hour, new signups (7d), open chat reports.',
  })
  @ApiResponse({ status: 200, description: 'Stats payload' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  @ApiResponse({ status: 403, description: 'User is not an admin (isAdmin !== true)' })
  async stats() {
    return this.statsService.getStats();
  }

  @Get('users')
  @UseGuards(FirebaseAuthGuard, AdminAuthGuard)
  @ApiOperation({
    summary: 'Paginated users for admin table',
    description: 'No message bodies — profile fields only. Sort favors recent desktop sync.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 25 })
  @ApiQuery({ name: 'verified', required: false, enum: ['all', 'true', 'false'] })
  @ApiResponse({ status: 200, description: 'Paginated user rows' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  @ApiResponse({ status: 403, description: 'Not an admin' })
  async usersList(
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('verified') verified?: 'all' | 'true' | 'false',
  ) {
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 25;
    return this.users.listUsers({
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 25,
      verified: verified ?? 'all',
    });
  }

  @Get('chat-reports')
  @UseGuards(FirebaseAuthGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'List chat reports (moderation queue)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 25 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['all', 'open', 'dismissed', 'reviewed', 'action_taken'],
  })
  @ApiResponse({ status: 200, description: 'Paginated reports' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  @ApiResponse({ status: 403, description: 'Not an admin' })
  async reportsList(
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('status') status?: string,
  ) {
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 25;
    let st: ChatReportStatus | 'all' = 'all';
    if (status && ['open', 'dismissed', 'reviewed', 'action_taken', 'all'].includes(status)) {
      st = status as ChatReportStatus | 'all';
    }
    return this.reports.listReports({
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 25,
      status: st,
    });
  }

  @Get('chat-reports/:reportId')
  @UseGuards(FirebaseAuthGuard, AdminAuthGuard)
  @ApiOperation({
    summary: 'Report detail with message preview',
    description: 'Includes metadata, participants, and the last N messages (chronological) for context.',
  })
  @ApiParam({ name: 'reportId', description: 'Mongo ObjectId of ChatReport' })
  @ApiResponse({ status: 200, description: 'Report detail + messages_preview' })
  @ApiResponse({ status: 400, description: 'Invalid report id' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  @ApiResponse({ status: 403, description: 'Not an admin' })
  @ApiResponse({ status: 404, description: 'Report or conversation not found' })
  async reportDetail(@Param('reportId') reportId: string) {
    return this.reports.getReportDetail(reportId);
  }

  @Patch('chat-reports/:reportId')
  @UseGuards(FirebaseAuthGuard, AdminAuthGuard)
  @ApiOperation({
    summary: 'Update report status / admin note',
    description: 'Closing a report (status !== open) sets resolved_at. admin_note max 2000 chars.',
  })
  @ApiParam({ name: 'reportId', description: 'Mongo ObjectId of ChatReport' })
  @ApiBody({ type: PatchChatReportDto })
  @ApiResponse({ status: 200, description: '{ ok: true }' })
  @ApiResponse({ status: 400, description: 'Invalid report id or body' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  @ApiResponse({ status: 403, description: 'Not an admin' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async reportPatch(@Param('reportId') reportId: string, @Body() dto: PatchChatReportDto) {
    return this.reports.patchReport(reportId, dto);
  }
}
