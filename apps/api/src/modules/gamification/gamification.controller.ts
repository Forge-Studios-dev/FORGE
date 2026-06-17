import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GamificationService } from './gamification.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Gamification')
@Controller()
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('communities/:communityId/leaderboard')
  @Public()
  @ApiOperation({ summary: 'Community XP leaderboard' })
  leaderboard(@Param('communityId') communityId: string) {
    return this.gamificationService.leaderboard(communityId);
  }

  @Get('communities/:communityId/gamification/me')
  @ApiOperation({ summary: 'My XP profile in a community' })
  me(@CurrentUser() user: JwtPayload, @Param('communityId') communityId: string) {
    return this.gamificationService.getProfile(user.sub, communityId);
  }

  @Post('communities/:communityId/gamification/check-in')
  @ApiOperation({ summary: 'Daily check-in for streak XP' })
  checkIn(@CurrentUser() user: JwtPayload, @Param('communityId') communityId: string) {
    return this.gamificationService.awardXp(user.sub, communityId, 10);
  }
}
