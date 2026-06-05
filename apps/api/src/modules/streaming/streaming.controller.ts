import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StreamingService } from './streaming.service';
import { toPublicStream } from './stream.mapper';
import { CreateStreamDto } from './dto/create-stream.dto';
import { SetSlowModeDto } from './dto/set-slow-mode.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/permissions';
import Mux from '@mux/mux-node';
import { ConfigService } from '@nestjs/config';

@ApiTags('Streaming')
@Controller('streams')
export class StreamingController {
  constructor(
    private readonly streamingService: StreamingService,
    private readonly configService: ConfigService,
  ) {}

  @Post('start')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.START_STREAM)
  @ApiOperation({ summary: 'Create a new live stream' })
  async createStream(@CurrentUser() user: JwtPayload, @Body() dto: CreateStreamDto) {
    const stream = await this.streamingService.createStream(user.sub, dto);
    return toPublicStream(stream, true);
  }
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('live')
  @ApiOperation({ summary: 'Get currently live streams' })
  async getLiveStreams(@CurrentUser() user?: JwtPayload) {
    return this.streamingService.getLiveStreams(user?.sub, user?.role);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get stream by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.streamingService.getStreamForViewer(id, user?.sub, user?.role);
  }

  @Post(':id/end')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.START_STREAM)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End a live stream' })
  endStream(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.streamingService.endStream(user.sub, id);
  }

  @Patch(':id/slow-mode')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.START_STREAM)
  @ApiOperation({ summary: 'Set chat slow mode for a live stream' })
  setSlowMode(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetSlowModeDto,
  ) {
    return this.streamingService.setSlowMode(user.sub, id, dto.slowModeSeconds);
  }

  @Public()
  @Post('webhooks/mux')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mux webhook handler' })
  handleMuxWebhook(
    @Req() req: { headers: Record<string, string | string[] | undefined>; rawBody?: Buffer },
    @Body() payload: Record<string, unknown>,
  ) {
    const secret = this.configService.get<string>('mux.webhookSecret');
    const nodeEnv = this.configService.get<string>('nodeEnv');

    let event = payload;
    if (secret?.trim()) {
      const raw = req.rawBody?.toString('utf-8');
      if (!raw) {
        throw new ForbiddenException('Invalid webhook signature');
      }
      const mux = new Mux({
        tokenId: this.configService.get<string>('mux.tokenId') || 'placeholder',
        tokenSecret: this.configService.get<string>('mux.tokenSecret') || 'placeholder',
      });
      try {
        mux.webhooks.verifySignature(raw, req.headers as Record<string, string>, secret);
        event = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        throw new ForbiddenException('Invalid webhook signature');
      }
    } else if (nodeEnv === 'production') {
      throw new ForbiddenException('Mux webhook verification is not configured');
    }

    return this.streamingService.handleMuxWebhook(event);
  }
}
