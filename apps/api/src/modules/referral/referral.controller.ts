import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReferralService } from './referral.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Referral')
@Controller()
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('me/referral')
  @ApiOperation({ summary: 'Get my referral code and stats (includes ambassador status)' })
  getStats(@CurrentUser() user: JwtPayload) {
    return this.referralService.getStats(user.sub);
  }

  @Post('me/referral/reward/:referredUserId')
  @ApiOperation({ summary: 'Grant referral reward when referred user qualifies (system use)' })
  grantReward(@Param('referredUserId', ParseUUIDPipe) referredUserId: string) {
    return this.referralService.grantReward(referredUserId);
  }

  @Public()
  @Get('platform/ambassadors')
  @ApiOperation({ summary: 'Ambassador leaderboard — top referrers (10+ completed referrals)' })
  getAmbassadorLeaderboard(@Query('limit') limit?: string) {
    return this.referralService.getAmbassadorLeaderboard(Number(limit) || 20);
  }
}
