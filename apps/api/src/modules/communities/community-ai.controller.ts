import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiCommunityService } from './ai-community.service';
import { AiBudgetService } from './ai-budget.service';
import { CreatorAuditService } from './creator-audit.service';
import { CommunitiesService } from './communities.service';
import { CommunityRoomMessagesService } from './community-room-messages.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Community AI')
@Controller()
export class CommunityAiController {
  constructor(
    private readonly aiCommunityService: AiCommunityService,
    private readonly auditService: CreatorAuditService,
    private readonly roomMessagesService: CommunityRoomMessagesService,
    private readonly communitiesService: CommunitiesService,
    private readonly aiBudget: AiBudgetService,
  ) {}

  @Post('creators/me/ai/moderation/score')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Score content for spam/toxicity (creator copilot)' })
  async scoreContent(@Body() body: { text: string }) {
    // TransformInterceptor wraps as { success, data } — return the score object directly.
    return this.aiCommunityService.scoreContentAsync(body.text ?? '');
  }

  @Get('creators/me/communities/:communityId/copilot/health')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Community health score and copilot tips' })
  async communityHealth(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
  ) {
    const analytics = await this.communitiesService.getCommunityAnalytics(
      user.sub,
      communityId,
    );
    const retention = analytics.retention;
    const payingMembers = retention?.activeSubscribers ?? 0;
    const engagedMembers = retention?.engagedMembers ?? 0;
    const retentionRate =
      payingMembers > 0 ? Math.round((engagedMembers / payingMembers) * 100) : undefined;
    return this.aiCommunityService.communityHealthScore({
      messagesLast7Days: analytics.messagesLast7Days,
      activeMembersLast7Days: analytics.activeMembersLast7Days,
      postsLast7Days: analytics.postsLast7Days,
      retentionRate,
    });
  }

  @Get('creators/me/communities/:communityId/rooms/:roomId/summary')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Summarize recent text room discussion' })
  async summarizeRoom(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('roomId') roomId: string,
  ) {
    const { data } = await this.roomMessagesService.listMessages(
      communityId,
      roomId,
      30,
      undefined,
      undefined,
      user.sub,
      user.role,
    );
    const summary = await this.aiCommunityService.summarizeDiscussionAsync(
      data.map((m) => m.body),
    );
    return { summary };
  }

  @Get('admin/ai/budget')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Daily AI/LLM budget usage (admin)' })
  async budgetUsage() {
    return this.aiBudget.usage();
  }

  @Post('creators/me/copilot/insights')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Claude-powered creator analytics insights and recommendations' })
  async creatorInsights(
    @Body()
    body: {
      totalSubscribers: number;
      mrr: number;
      churnRate?: number;
      videoViews: number;
      lessonCompletionRate?: number;
      communityEngagement?: number;
      topContentTitles?: string[];
    },
  ) {
    return this.aiCommunityService.generateCreatorInsights(body);
  }

  @Get('creators/me/audit-logs')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Creator audit log history' })
  auditLogs(@CurrentUser() user: JwtPayload, @Query('limit') limit = 50) {
    return this.auditService.listForCreator(user.sub, Number(limit) || 50);
  }
}
