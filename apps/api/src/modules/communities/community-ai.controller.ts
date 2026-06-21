import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiCommunityService } from './ai-community.service';
import { CreatorAuditService } from './creator-audit.service';
import { CommunitiesService } from './communities.service';
import { CommunityRoomMessagesService } from './community-room-messages.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';

@ApiTags('Community AI')
@Controller()
export class CommunityAiController {
  constructor(
    private readonly aiCommunityService: AiCommunityService,
    private readonly auditService: CreatorAuditService,
    private readonly roomMessagesService: CommunityRoomMessagesService,
    private readonly communitiesService: CommunitiesService,
  ) {}

  @Post('creators/me/ai/moderation/score')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Score content for spam/toxicity (creator copilot)' })
  async scoreContent(@Body() body: { text: string }) {
    return { data: await this.aiCommunityService.scoreContentAsync(body.text ?? '') };
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
    const health = this.aiCommunityService.communityHealthScore({
      messagesLast7Days: analytics.messagesLast7Days,
      activeMembersLast7Days: analytics.activeMembersLast7Days,
      postsLast7Days: analytics.postsLast7Days,
      retentionRate,
    });
    return { data: health };
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
    return { data: { summary } };
  }

  @Get('creators/me/audit-logs')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Creator audit log history' })
  auditLogs(@CurrentUser() user: JwtPayload, @Query('limit') limit = 50) {
    return this.auditService.listForCreator(user.sub, Number(limit) || 50);
  }
}
