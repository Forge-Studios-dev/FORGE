import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LiveBroadcastService } from './live-broadcast.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/permissions';

@ApiTags('Live Broadcast')
@Controller('streams/:streamId/broadcast/browser')
export class LiveBroadcastController {
  constructor(private readonly liveBroadcastService: LiveBroadcastService) {}

  @Post('token')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.START_STREAM)
  @ApiOperation({ summary: 'Get LiveKit publisher token for browser go-live' })
  createToken(@CurrentUser() user: JwtPayload, @Param('streamId') streamId: string) {
    return this.liveBroadcastService.createPublisherToken(streamId, user.sub);
  }

  @Post('start')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.START_STREAM)
  @ApiOperation({ summary: 'Start RTMP egress from LiveKit room to Mux' })
  startEgress(@CurrentUser() user: JwtPayload, @Param('streamId') streamId: string) {
    return this.liveBroadcastService.startBrowserEgress(streamId, user.sub);
  }

  @Post('stop')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.START_STREAM)
  @ApiOperation({ summary: 'Stop browser RTMP egress' })
  stopEgress(@CurrentUser() user: JwtPayload, @Param('streamId') streamId: string) {
    return this.liveBroadcastService.stopBrowserEgress(streamId, user.sub);
  }
}
