import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiCommunityService } from './ai-community.service';
import { CreatorAuditService } from './creator-audit.service';
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
  ) {}

  @Post('creators/me/ai/moderation/score')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Score content for spam/toxicity (creator copilot)' })
  scoreContent(@Body() body: { text: string }) {
    return { data: this.aiCommunityService.scoreContent(body.text ?? '') };
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
    const summary = this.aiCommunityService.summarizeDiscussion(data.map((m) => m.body));
    return { data: { summary } };
  }

  @Get('creators/me/audit-logs')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Creator audit log history' })
  auditLogs(@CurrentUser() user: JwtPayload, @Query('limit') limit = 50) {
    return this.auditService.listForCreator(user.sub, Number(limit) || 50);
  }
}
