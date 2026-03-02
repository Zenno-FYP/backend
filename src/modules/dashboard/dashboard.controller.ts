import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { PerformanceMetricsResponseDto } from './dto/dashboard-metrics.dto';

@ApiTags('Dashboard')
@Controller('api/v1/dashboard')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

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

  // Placeholder for tool-usage endpoint
  @Get('tool-usage')
  @ApiOperation({
    summary: 'Get tool usage analytics',
    description: 'Get detailed breakdown of tool usage across projects and time periods.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tool usage data retrieved successfully',
  })
  async getToolUsage(@Request() req: any) {
    return {
      message: 'Tool usage endpoint - coming soon',
      note: 'Implementation pending',
    };
  }

  // Placeholder for project-insights endpoint
  @Get('project-insights')
  @ApiOperation({
    summary: 'Get project insights',
    description: 'Get insights and analytics for each project.',
  })
  @ApiResponse({
    status: 200,
    description: 'Project insights retrieved successfully',
  })
  async getProjectInsights(@Request() req: any) {
    return {
      message: 'Project insights endpoint - coming soon',
      note: 'Implementation pending',
    };
  }
}
