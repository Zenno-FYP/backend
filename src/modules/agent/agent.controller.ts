import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { UpdateAgentPreferencesDto } from './dto/update-agent-preferences.dto';
import { SyncNudgesDto } from './dto/sync-nudges.dto';

@ApiTags('Agent')
@Controller('api/v1/agent')
@ApiBearerAuth('firebase')
@UseGuards(FirebaseAuthGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  // ── Preferences ────────────────────────────────────────────────────────────

  @Get('preferences')
  @ApiOperation({ summary: 'Get agent personalisation preferences for the current user' })
  @ApiResponse({ status: 200, description: 'Preferences returned' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  async getPreferences(@Request() req: any) {
    const prefs = await this.agentService.getPreferences(req.user.uid);
    return { success: true, data: prefs };
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update agent personalisation preferences (website → desktop agent)' })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  async updatePreferences(
    @Request() req: any,
    @Body() dto: UpdateAgentPreferencesDto,
  ) {
    const prefs = await this.agentService.updatePreferences(req.user.uid, dto);
    return { success: true, data: prefs };
  }

  // ── Nudge stats ────────────────────────────────────────────────────────────

  @Get('nudges/stats')
  @ApiOperation({ summary: 'Get nudge statistics (total, today, this week)' })
  @ApiResponse({ status: 200, description: 'Nudge stats returned' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  async getNudgeStats(@Request() req: any) {
    const stats = await this.agentService.getNudgeStats(req.user.uid);
    return { success: true, data: stats };
  }

  // ── Nudge sync (called by desktop agent) ───────────────────────────────────

  @Post('nudges/sync')
  @ApiOperation({ summary: 'Sync nudge records from the desktop agent' })
  @ApiResponse({ status: 200, description: 'Nudges synced' })
  @ApiResponse({ status: 401, description: 'Invalid or missing Firebase token' })
  async syncNudges(@Request() req: any, @Body() dto: SyncNudgesDto) {
    const result = await this.agentService.syncNudges(req.user.uid, dto.records);
    return { success: true, data: result };
  }
}
