import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { AiCommunityService } from './ai-community.service';
import { AiBudgetService } from './ai-budget.service';
import { CreatorAuditService } from './creator-audit.service';
import { CommunitiesService } from './communities.service';
import { CommunityRoomMessagesService } from './community-room-messages.service';
import { CommunityModerationQueueService } from './community-moderation-queue.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CommunityRoleGuard } from './guards/community-role.guard';
import { CommunityRoles } from './decorators/community-roles.decorator';
import { CommunityRoleType } from './entities/community-role.entity';

class ScoreCommunityContentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  text: string;
}

class CreatorInsightsDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  totalSubscribers: number;

  @ApiProperty()
  @IsNumber()
  mrr: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  churnRate?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  videoViews: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lessonCompletionRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  communityEngagement?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topContentTitles?: string[];
}

@ApiTags('Community AI')
@Controller()
export class CommunityAiController {
  constructor(
    private readonly aiCommunityService: AiCommunityService,
    private readonly auditService: CreatorAuditService,
    private readonly roomMessagesService: CommunityRoomMessagesService,
    private readonly communitiesService: CommunitiesService,
    private readonly aiBudget: AiBudgetService,
    private readonly moderationQueue: CommunityModerationQueueService,
  ) {}

  @Post('creators/me/ai/moderation/score')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Score content for spam/toxicity (creator copilot)' })
  async scoreContent(@Body() body: ScoreCommunityContentDto) {
    // TransformInterceptor wraps as { success, data } — return the score object directly.
    return this.aiCommunityService.scoreContentAsync(body.text ?? '');
  }

  @Get('creators/me/communities/:communityId/copilot/health')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Community health score and copilot tips' })
  async communityHealth(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
  ) {
    const analytics = await this.communitiesService.getCommunityAnalytics(
      user.sub,
      communityId,
      user.role,
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
  @UseGuards(CreatorApprovedGuard, CommunityRoleGuard)
  @CommunityRoles(CommunityRoleType.OWNER, CommunityRoleType.ADMIN, CommunityRoleType.COACH)
  @ApiOperation({ summary: 'Summarize recent text room discussion' })
  async summarizeRoom(
    @CurrentUser() user: JwtPayload,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
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
  @ApiOperation({ summary: 'Daily AI/LLM budget usage and moderation queue depth (admin)' })
  async budgetUsage() {
    return {
      ...(await this.aiBudget.usage()),
      queue: await this.moderationQueue.getQueueCounts(),
    };
  }

  @Post('creators/me/copilot/insights')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Claude-powered creator analytics insights and recommendations' })
  async creatorInsights(
    @Body() body: CreatorInsightsDto,
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
