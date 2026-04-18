import { Controller, Get, Patch, Delete, Body, Param, Query, UseGuards, Request, HttpCode, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { ToolUsageService } from './tool-usage.service';
import { PeersService } from './peers.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { PerformanceMetricsResponseDto } from './dto/dashboard-metrics.dto';
import { ToolUsageResponseDto } from './dto/tool-usage.dto';
import { ToolUsageDetailResponseDto } from './dto/tool-usage-detail.dto';
import { ProjectInsightsResponseDto } from './dto/project-insights.dto';
import { PerformanceMetricsDetailResponseDto } from './dto/performance-metrics-detail.dto';
import { SkillsProjectsDetailResponseDto } from './dto/skills-projects-detail.dto';
import { ProjectDetailResponseDto, UpdateProjectDto } from './dto/project-detail.dto';
import { ProfilePageResponseDto } from './dto/profile-page.dto';
import { PublicProfileResponseDto } from './dto/public-profile.dto';
import { PeersSearchResponseDto } from './dto/peers-search.dto';

@ApiTags('Dashboard')
@Controller('api/v1/dashboard')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly toolUsageService: ToolUsageService,
    private readonly peersService: PeersService,
  ) {}

  @Get('performance-metrics')
  @ApiOperation({
    summary: 'Get dashboard performance metrics',
    description:
      'Get performance metrics comparing a 7-day window vs the prior 7 days. ' +
      'Pass ?period=previous_week to shift the window back 7 days (8–14 days ago vs 15–21 days ago). ' +
      'Default is current_week (last 7 days).',
  })
  @ApiResponse({ status: 200, description: 'Performance metrics retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid period value' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid firebase token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getPerformanceMetrics(
    @Request() req: any,
    @Query('period') period?: string,
  ): Promise<PerformanceMetricsResponseDto> {
    if (period && !['current_week', 'previous_week'].includes(period)) {
      throw new BadRequestException('period must be current_week or previous_week');
    }
    return this.dashboardService.getPerformanceMetrics(req.user.email, period);
  }

  @Get('performance-metrics-detail')
  @ApiOperation({
    summary: 'Performance metrics detail (7-day summary + daily behavior)',
    description:
      'Returns the same performance summary as the dashboard home (vs prior 7 days) plus a daily series derived from activity behavior: typing KPM, mouse CPM, correction rate, active/idle hours, deletions, and mouse movement.',
  })
  @ApiResponse({ status: 200, description: 'Performance metrics detail retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid firebase token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getPerformanceMetricsDetail(@Request() req: any): Promise<PerformanceMetricsDetailResponseDto> {
    return this.dashboardService.getPerformanceMetricsDetail(req.user.email);
  }

  @Get('tool-usage')
  @ApiOperation({
    summary: 'Get tool usage analytics',
    description:
      'Get detailed breakdown of app usage and language distribution. Shows top apps by time spent and top programming languages by lines of code.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tool usage data retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid firebase token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getToolUsage(@Request() req: any): Promise<ToolUsageResponseDto> {
    return this.toolUsageService.getToolUsage(req.user.email);
  }

  @Get('tool-usage-detail')
  @ApiOperation({
    summary: 'Apps & languages analytics (detail)',
    description:
      'Last 7 days: top apps (up to 10) with change vs prior week, per-day total app hours, unique app count, and language distribution (up to 15) from project lines of code.',
  })
  @ApiResponse({ status: 200, description: 'Tool usage detail retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid firebase token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getToolUsageDetail(@Request() req: any): Promise<ToolUsageDetailResponseDto> {
    return this.toolUsageService.getToolUsageDetail(req.user.email);
  }

  @Get('project-insights')
  @ApiOperation({
    summary: 'Get project insights',
    description: 'Get strongest skills (cumulative all-time) and current projects sorted by recency.',
  })
  @ApiResponse({
    status: 200,
    description: 'Project insights retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid firebase token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProjectInsights(@Request() req: any): Promise<ProjectInsightsResponseDto> {
    return this.dashboardService.getProjectInsights(req.user.email);
  }

  @Get('skills-projects-detail')
  @ApiOperation({
    summary: 'Skills & projects overview (detail)',
    description:
      'Skills from project_skills; active time (activity.apps) per project and total; lines/files from current_loc.',
  })
  @ApiResponse({ status: 200, description: 'Skills/projects detail retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid firebase token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getSkillsProjectsDetail(@Request() req: any): Promise<SkillsProjectsDetailResponseDto> {
    return this.dashboardService.getSkillsProjectsDetail(req.user.email);
  }

  @Get('profile-page')
  @ApiOperation({
    summary: 'Profile page analytics',
    description:
      'Streak (days with activity), global top skills/apps/languages, and per-project summaries for the profile UI.',
  })
  @ApiResponse({ status: 200, description: 'Profile page data retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfilePage(@Request() req: any): Promise<ProfilePageResponseDto> {
    return this.dashboardService.getProfilePage(req.user.email);
  }

  @Get('users/:userId/public-profile')
  @ApiOperation({
    summary: 'Public profile view for another user',
    description:
      'Same analytics shape as profile-page, filtered by that user’s profile preferences (hidden items, project order). Safe fields only — no email.',
  })
  @ApiResponse({ status: 200, description: 'Public profile payload' })
  @ApiResponse({ status: 400, description: 'Invalid user id' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPublicProfile(
    @Request() req: any,
    @Param('userId') userId: string,
  ): Promise<PublicProfileResponseDto> {
    return this.dashboardService.getPublicProfileByUserId(req.user.email, userId);
  }

  @Get('peers/search')
  @ApiOperation({
    summary: 'Search other developers',
    description:
      'Returns public-style cards for other users (excludes you). Optional q: substring search on name, bio, skills, project names, and app names; multiple words all must match.',
  })
  @ApiResponse({ status: 200, description: 'Peer list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async searchPeers(@Request() req: any, @Query('q') q?: string): Promise<PeersSearchResponseDto> {
    const peers = await this.peersService.searchPeers(req.user.email, q ?? '');
    return { peers };
  }

  @Get('projects/:projectName')
  @ApiOperation({ summary: 'Single project (for detail page)' })
  @ApiResponse({ status: 200, description: 'Project detail retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project or user not found' })
  async getProjectDetail(
    @Request() req: any,
    @Param('projectName') encodedName: string,
  ): Promise<ProjectDetailResponseDto> {
    const name = decodeURIComponent(encodedName);
    return this.dashboardService.getProjectDetail(req.user.email, name);
  }

  @Patch('projects/:projectName')
  @ApiOperation({ summary: 'Update project display name and description' })
  @ApiResponse({ status: 200, description: 'Updated project returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async updateProject(
    @Request() req: any,
    @Param('projectName') encodedName: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectDetailResponseDto> {
    const name = decodeURIComponent(encodedName);
    return this.dashboardService.updateProject(req.user.email, name, dto);
  }

  @Delete('projects/:projectName')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete project and all its daily activity',
    description:
      'Removes the project document and every activity (daily aggregate) row for this user and project_name. The desktop agent may recreate the project on a future sync.',
  })
  @ApiResponse({ status: 204, description: 'Project and related activity deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project or user not found' })
  async deleteProject(@Request() req: any, @Param('projectName') encodedName: string): Promise<void> {
    const name = decodeURIComponent(encodedName);
    await this.dashboardService.deleteProject(req.user.email, name);
  }
}
