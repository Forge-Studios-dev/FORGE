import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChannelPointsService } from './channel-points.service';
import {
  ChannelPointRedemptionStatus,
  ChannelPointRewardStatus,
} from './entities/channel-points.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { clampLimit } from '../../common/utils/pagination.util';

@ApiTags('Channel Points')
@Controller()
export class ChannelPointsController {
  constructor(private readonly channelPointsService: ChannelPointsService) {}

  // ── Admin oversight ───────────────────────────────────────────────────────

  @Roles(UserRole.ADMIN)
  @Get('admin/channel-points/redemptions')
  @ApiOperation({ summary: 'List pending channel-point redemptions (admin)' })
  adminRedemptions(@Query('limit') limit = 50) {
    return this.channelPointsService.adminListPendingRedemptions(clampLimit(limit, 50, 100));
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/channel-points/summary')
  @ApiOperation({ summary: 'Channel points summary by community (admin)' })
  adminSummary(@Query('limit') limit = 50) {
    return this.channelPointsService.adminCommunityPointsSummary(clampLimit(limit, 50, 100));
  }

  // ── Member: balance & public catalog ──────────────────────────────────────

  @Get('communities/:communityId/channel-points/me')
  @ApiOperation({ summary: 'Get my channel points balance for a community' })
  myBalance(@CurrentUser() user: JwtPayload, @Param('communityId') communityId: string) {
    return this.channelPointsService.getBalance(user.sub, communityId);
  }

  @Get('communities/:communityId/channel-points/rewards')
  @ApiOperation({ summary: 'List active channel point rewards for a community' })
  listRewards(@Param('communityId') communityId: string) {
    return this.channelPointsService.listRewards(communityId, false);
  }

  @Post('communities/:communityId/channel-points/redeem')
  @ApiOperation({ summary: 'Redeem a channel point reward' })
  redeem(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body() body: { rewardId: string; message?: string },
  ) {
    return this.channelPointsService.redeem(user.sub, communityId, body.rewardId, body.message);
  }

  // ── Creator: rewards management ───────────────────────────────────────────

  @UseGuards(CreatorApprovedGuard)
  @Get('creators/me/communities/:communityId/channel-points/rewards')
  @ApiOperation({ summary: 'List channel point rewards for creator management (includes paused)' })
  listCreatorRewards(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
  ) {
    return this.channelPointsService.listCreatorRewards(user.sub, communityId);
  }

  @UseGuards(CreatorApprovedGuard)
  @Post('creators/me/communities/:communityId/channel-points/rewards')
  @ApiOperation({ summary: 'Create a channel point reward (creator)' })
  createReward(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body()
    body: {
      title: string;
      description?: string;
      costPoints: number;
      maxPerUser?: number;
      globalMax?: number;
      requiresApproval?: boolean;
    },
  ) {
    return this.channelPointsService.createReward(user.sub, communityId, body);
  }

  @UseGuards(CreatorApprovedGuard)
  @Patch('creators/me/communities/:communityId/channel-points/rewards/:rewardId')
  @ApiOperation({ summary: 'Update a channel point reward (creator)' })
  updateReward(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('rewardId') rewardId: string,
    @Body()
    body: {
      title?: string;
      description?: string | null;
      costPoints?: number;
      maxPerUser?: number | null;
      globalMax?: number | null;
      requiresApproval?: boolean;
      status?: ChannelPointRewardStatus;
    },
  ) {
    return this.channelPointsService.updateReward(user.sub, communityId, rewardId, body);
  }

  @UseGuards(CreatorApprovedGuard)
  @Delete('creators/me/communities/:communityId/channel-points/rewards/:rewardId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a channel point reward (creator)' })
  async deleteReward(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('rewardId') rewardId: string,
  ) {
    await this.channelPointsService.deleteReward(user.sub, communityId, rewardId);
  }

  // ── Creator: redemption management ────────────────────────────────────────

  @UseGuards(CreatorApprovedGuard)
  @Get('creators/me/communities/:communityId/channel-points/redemptions')
  @ApiOperation({ summary: 'List redemptions for creator review' })
  listRedemptions(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Query('status') status?: ChannelPointRedemptionStatus,
    @Query('limit') limit?: number,
  ) {
    return this.channelPointsService.listRedemptions(user.sub, communityId, {
      status,
      limit: limit ? Number(limit) : 50,
    });
  }

  @UseGuards(CreatorApprovedGuard)
  @Post('creators/me/communities/:communityId/channel-points/redemptions/:redemptionId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending redemption' })
  async approve(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('redemptionId') redemptionId: string,
  ) {
    await this.channelPointsService.approveRedemption(user.sub, communityId, redemptionId);
    return { ok: true };
  }

  @UseGuards(CreatorApprovedGuard)
  @Post('creators/me/communities/:communityId/channel-points/redemptions/:redemptionId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject and refund a pending redemption' })
  async reject(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Param('redemptionId') redemptionId: string,
  ) {
    await this.channelPointsService.rejectRedemption(user.sub, communityId, redemptionId);
    return { ok: true };
  }
}
