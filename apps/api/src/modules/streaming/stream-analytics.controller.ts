import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StreamAnalyticsService } from './stream-analytics.service';
import { StreamLiveService } from './stream-live.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';

@ApiTags('Stream Analytics')
@Controller('creators/me/streams')
export class StreamAnalyticsController {
  constructor(
    private readonly streamAnalyticsService: StreamAnalyticsService,
    private readonly streamLiveService: StreamLiveService,
  ) {}

  @Get(':streamId/analytics')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Live stream analytics for creator' })
  getAnalytics(@CurrentUser() user: JwtPayload, @Param('streamId') streamId: string) {
    return this.streamAnalyticsService.getCreatorStreamAnalytics(
      user.sub,
      streamId,
      user.sub,
      user.role,
    );
  }

  @Get(':streamId/health')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Stream ingest health for creator' })
  getHealth(@CurrentUser() user: JwtPayload, @Param('streamId') streamId: string) {
    return this.streamLiveService.getStreamHealth(streamId, user.sub, user.role);
  }
}
