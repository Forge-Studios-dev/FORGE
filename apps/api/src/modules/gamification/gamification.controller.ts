import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GamificationService } from './gamification.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CommunitiesService } from '../communities/communities.service';

@ApiTags('Gamification')
@Controller()
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
}
