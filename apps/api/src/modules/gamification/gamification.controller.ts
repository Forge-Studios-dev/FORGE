import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GamificationService } from './gamification.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CommunitiesService } from '../communities/communities.service';
import { SkillEconomyLmsGuard } from '../../common/guards/skill-economy-lms.guard';

@ApiTags('Gamification')
@Controller()
@UseGuards(SkillEconomyLmsGuard)
export class GamificationController {
  constructor(
    private readonly gamificationService: GamificationService,
    private readonly communitiesService: CommunitiesService,
  ) {}

  @Get('communities/:communityId/leaderboard')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Community XP leaderboard' })
  async leaderboard(
    @Param('communityId') communityId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, user?.sub, user?.role);
    return this.gamificationService.leaderboard(communityId);
  }

  @Get('communities/:communityId/gamification/me')
  @ApiOperation({ summary: 'My XP profile in a community' })
  async me(@CurrentUser() user: JwtPayload, @Param('communityId') communityId: string) {
    await this.communitiesService.assertCommunityAccess(communityId, user.sub, user.role);
    return this.gamificationService.getProfile(user.sub, communityId);
  }

  @Post('communities/:communityId/gamification/check-in')
  @ApiOperation({ summary: 'Daily check-in for streak XP' })
  async checkIn(@CurrentUser() user: JwtPayload, @Param('communityId') communityId: string) {
    await this.communitiesService.assertCommunityAccess(communityId, user.sub, user.role);
    return this.gamificationService.checkIn(user.sub, communityId);
  }

  // ── Platform-wide endpoints ────────────────────────────────────────────────

  @Get('platform/gamification/me')
  @ApiOperation({ summary: 'My platform-wide XP profile' })
  platformProfile(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.getPlatformProfile(user.sub);
  }

  @Post('platform/gamification/check-in')
  @ApiOperation({ summary: 'Platform-wide daily check-in (cross-community XP)' })
  platformCheckIn(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.platformCheckIn(user.sub);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('platform/gamification/leaderboard')
  @ApiOperation({ summary: 'Platform-wide XP leaderboard' })
  platformLeaderboard(@Query('limit') limit = 20) {
    return this.gamificationService.platformLeaderboard(Number(limit) || 20);
  }

  @Get('platform/gamification/achievements')
  @ApiOperation({ summary: 'My achievements — full catalog with earned status' })
  listAchievements(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.listAchievements(user.sub);
  }

  @Get('platform/gamification/reputation')
  @ApiOperation({ summary: 'My reputation score (composite: XP + followers + content + achievements)' })
  reputationScore(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.getReputationScore(user.sub);
  }

  @Get('platform/gamification/analytics')
  @ApiOperation({ summary: 'My gamification analytics: XP trend, top actions, streak stats' })
  gamificationAnalytics(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.getGamificationAnalytics(user.sub);
  }

  @Get('users/:userId/reputation')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Public reputation score for any user' })
  publicReputation(@Param('userId') userId: string) {
    return this.gamificationService.getReputationScore(userId);
  }

  // ── Badge Studio (creator configures community badge tiers) ───────────────

  @Get('creators/me/communities/:communityId/badge-config')
  @ApiOperation({ summary: 'Get community badge XP tier configuration' })
  async getBadgeConfig(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
  ) {
    const config = await this.communitiesService.getBadgeConfig(communityId, user.sub);
    return { data: config };
  }

  @Put('creators/me/communities/:communityId/badge-config')
  @ApiOperation({ summary: 'Set community badge XP tier configuration (max 5 tiers)' })
  async setBadgeConfig(
    @CurrentUser() user: JwtPayload,
    @Param('communityId') communityId: string,
    @Body() body: { tiers: Array<{ key: string; label: string; xpThreshold: number; icon?: string }> },
  ) {
    const config = await this.communitiesService.setBadgeConfig(communityId, user.sub, body.tiers);
    return { data: config };
  }
}
