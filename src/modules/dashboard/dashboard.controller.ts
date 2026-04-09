import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { ToolUsageService } from './tool-usage.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { PerformanceMetricsResponseDto } from './dto/dashboard-metrics.dto';
import { ToolUsageResponseDto } from './dto/tool-usage.dto';
import { ProjectInsightsResponseDto } from './dto/project-insights.dto';
import { PerformanceMetricsDetailResponseDto } from './dto/performance-metrics-detail.dto';

@ApiTags('Dashboard')
@Controller('api/v1/dashboard')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly toolUsageService: ToolUsageService,
  ) {}

  @Get('performance-metrics')
  @ApiOperation({
    summary: 'Get dashboard performance metrics',
    description:
      'Get performance metrics comparing current 7 days vs previous 7 days. Returns key metrics (WPM, daily active average, clicks, scrolls, idle time) with trends and daily breakdown for stacked bar chart.',
  })
  @ApiResponse({ status: 200, description: 'Performance metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid firebase token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getPerformanceMetrics(@Request() req: any): Promise<PerformanceMetricsResponseDto> {
    return this.dashboardService.getPerformanceMetrics(req.user.email);
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
}
