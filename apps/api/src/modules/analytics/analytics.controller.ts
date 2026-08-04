import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from './analytics.service';
import { KpiService } from './kpi.service';
import { IngestEventDto } from './dto/ingest-event.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import { AppCheckGuard } from '../firebase/app-check.guard';
import { RequireAppCheck } from '../firebase/app-check.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly kpiService: KpiService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @UseGuards(AppCheckGuard)
  @RequireAppCheck()
  @Post('events')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ingest client analytics event (optional Bearer for attribution)' })
  async ingest(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: IngestEventDto,
  ) {
    let userId: string | null = null;
    const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (bearer) {
      try {
        const payload = this.jwtService.verify<JwtPayload>(bearer, {
          secret: this.configService.get<string>('jwt.secret'),
        });
        userId = payload.sub;
      } catch {
        // ignore invalid token for optional attribution
      }
    }
    await this.analyticsService.ingest(userId, dto);
  }

  @Get('kpi/platform/churn')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Platform churn rate KPI (admin)' })
  async platformChurn(@Query('window') window = 30) {
    return this.kpiService.computePlatformChurnRate(Number(window) || 30);
  }

  @Get('kpi/platform/dashboard')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Platform KPI dashboard: churn + top engaged users (admin)' })
  async platformDashboard() {
    return this.kpiService.platformDashboard();
  }

  @Get('kpi/me/engagement')
  @ApiOperation({ summary: 'My engagement score (0-100)' })
  async myEngagement(@CurrentUser() user: JwtPayload) {
    return this.kpiService.computeUserEngagementScore(user.sub);
  }

  @Get('kpi/communities/:communityId/churn')
  @ApiOperation({ summary: 'Community growth + engagement KPI for creator' })
  async communityChurn(
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Query('window') window = 30,
  ) {
    return this.kpiService.computeCommunityChurnKpi(communityId, Number(window) || 30);
  }

  @Get('kpi/communities/:communityId/churn-prediction')
  @ApiOperation({ summary: 'P12-T024: Identify at-risk members likely to churn' })
  async communityChurnPrediction(
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Query('window') window = 30,
  ) {
    return this.kpiService.predictCommunityChurn(communityId, Number(window) || 30);
  }

  @Get('kpi/communities/:communityId/predictions')
  @ApiOperation({ summary: 'P12-T023/025/026: Community health score, engagement prediction, and risk assessment' })
  async communityPredictions(@Param('communityId', ParseUUIDPipe) communityId: string) {
    return this.kpiService.communityPredictions(communityId);
  }
}
