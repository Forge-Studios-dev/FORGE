import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StreamingService } from './streaming.service';
import { toPublicStream } from './stream.mapper';
import { CreateStreamDto } from './dto/create-stream.dto';
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
  @Get('live')
  @ApiOperation({ summary: 'Get currently live streams' })
  async getLiveStreams() {
    const streams = await this.streamingService.getLiveStreams();
    return streams.map((s) => toPublicStream(s, false));
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get stream by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.streamingService.findById(id).then((stream) => {
      const includeIngest = !!user && user.sub === stream.userId;
      return toPublicStream(stream, includeIngest);
    });
  }

  @Post(':id/end')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.START_STREAM)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End a live stream' })
  endStream(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.streamingService.endStream(user.sub, id);
  }

  @Public()
  @Post('webhooks/mux')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mux webhook handler' })
  handleMuxWebhook(@Req() req: { headers: Record<string, unknown>; rawBody?: Buffer }, @Body() payload: Record<string, unknown>) {
    const secret = this.configService.get<string>('mux.webhookSecret');
    const nodeEnv = this.configService.get<string>('nodeEnv');
    if (nodeEnv === 'production' && !secret?.trim()) {
      throw new ForbiddenException('Mux webhook verification is not configured');
    }
    if (!secret?.trim()) {
      return this.streamingService.handleMuxWebhook(payload);
    }
    const signature = (req.headers['mux-signature'] as string | undefined) || '';
    try {
      const raw = req.rawBody ? req.rawBody.toString('utf-8') : JSON.stringify(payload);
      (Mux as unknown as { Webhooks: { verifyHeader: (body: string, sig: string, secret: string) => boolean } })
        .Webhooks.verifyHeader(raw, signature, secret);
    } catch {
      throw new ForbiddenException('Invalid webhook signature');
    }
    return this.streamingService.handleMuxWebhook(payload);
  }
}
