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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StreamingService } from './streaming.service';
import { StreamLiveService } from './stream-live.service';
import { toPublicStream } from './stream.mapper';
import { CreateStreamDto } from './dto/create-stream.dto';
import { SetSlowModeDto } from './dto/set-slow-mode.dto';
import { AddStreamModeratorDto, CreateStreamPollDto, VoteStreamPollDto } from './dto/stream-live.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/permissions';
import Mux from '@mux/mux-node';
import { ConfigService } from '@nestjs/config';
import { BillingService } from '../billing/billing.service';
import { GrantStreamAccessDto } from './dto/grant-stream-access.dto';
import { CreateEventCheckoutDto } from '../billing/dto/create-event-checkout.dto';
import { CreateStreamClipDto } from './dto/create-stream-clip.dto';
import { UsersService } from '../users/users.service';

@ApiTags('Streaming')
@Controller('streams')
export class StreamingController {
  constructor(
    private readonly streamingService: StreamingService,
    private readonly streamLiveService: StreamLiveService,
    private readonly configService: ConfigService,
    private readonly billingService: BillingService,
    private readonly usersService: UsersService,
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
  @Get('upcoming')
  @ApiOperation({ summary: 'Get scheduled upcoming streams' })
  async getUpcomingStreams(@CurrentUser() user?: JwtPayload) {
    return this.streamingService.getUpcomingStreams(user?.sub, user?.role);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get stream by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.streamingService.getStreamForViewer(id, user?.sub, user?.role);
  }

  @Post(':id/grant-access')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.START_STREAM)
  @ApiOperation({ summary: 'Grant paid event access to a user (creator)' })
  async grantAccess(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: GrantStreamAccessDto,
  ) {
    const userId = await this.usersService.resolveUserId(dto);
    return this.streamingService.grantStreamEventAccess(user.sub, id, userId, {
      note: dto.note,
    });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/replay')
  @ApiOperation({ summary: 'Get VOD replay for an ended stream' })
  getReplay(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.streamingService.getStreamReplayVideo(id, user?.sub, user?.role);
  }

  @Post(':id/checkout')
  @ApiOperation({ summary: 'Create Stripe checkout for a paid live event ticket' })
  createEventCheckout(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateEventCheckoutDto,
  ) {
    return this.billingService.createEventCheckout(user.sub, { ...dto, streamId: id });
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
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/rsvp')
  @ApiOperation({ summary: 'Get RSVP status for a scheduled stream' })
  getRsvp(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.streamLiveService.getRsvpStatus(id, user?.sub);
  }

  @Post(':id/rsvp')
  @ApiOperation({ summary: 'RSVP to a scheduled stream' })
  createRsvp(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.streamLiveService.rsvp(id, user.sub);
  }

  @Post(':id/rsvp/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel RSVP' })
  cancelRsvp(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.streamLiveService.cancelRsvp(id, user.sub);
  }

  @Get(':id/moderators')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.START_STREAM)
  @ApiOperation({ summary: 'List stream moderators' })
  listModerators(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.streamLiveService.listModerators(id, user.sub, user.role);
  }

  @Post(':id/moderators')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.START_STREAM)
  @ApiOperation({ summary: 'Add a stream moderator' })
  addModerator(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddStreamModeratorDto,
  ) {
    return this.streamLiveService.addModerator(id, user.sub, dto, user.role);
  }

  @Post(':id/moderators/:userId/remove')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.START_STREAM)
  @ApiOperation({ summary: 'Remove a stream moderator' })
  removeModerator(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.streamLiveService.removeModerator(id, user.sub, targetUserId, user.role);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/moderator-status')
  @ApiOperation({ summary: 'Check if current user can moderate' })
  async moderatorStatus(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    if (!user?.sub) return { isMod: false };
    const isMod = await this.streamLiveService.canModerate(id, user.sub, user.role);
    return { isMod };
  }

  @Public()
  @Get(':id/poll')
  @ApiOperation({ summary: 'Get active poll for stream' })
  getActivePoll(@Param('id') id: string) {
    return this.streamLiveService.getActivePoll(id);
  }

  @Post(':id/polls')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.START_STREAM)
  @ApiOperation({ summary: 'Create a live poll' })
  createPoll(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateStreamPollDto,
  ) {
    return this.streamLiveService.createPoll(id, user.sub, dto, user.role);
  }

  @Post(':id/polls/:pollId/vote')
  @ApiOperation({ summary: 'Vote on a poll' })
  votePoll(
    @CurrentUser() user: JwtPayload,
    @Param('pollId') pollId: string,
    @Body() dto: VoteStreamPollDto,
  ) {
    return this.streamLiveService.votePoll(pollId, user.sub, dto.optionIndex);
  }

  @Post(':id/polls/:pollId/close')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.START_STREAM)
  @ApiOperation({ summary: 'Close a poll' })
  closePoll(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('pollId') pollId: string,
  ) {
    return this.streamLiveService.closePoll(id, pollId, user.sub, user.role);
  }

  @Public()
  @Get(':id/clips')
  @ApiOperation({ summary: 'List highlight clips for a stream' })
  listClips(@Param('id') id: string) {
    return this.streamLiveService.listClips(id);
  }

  @Post(':id/clips')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.START_STREAM)
  @ApiOperation({ summary: 'Mark a highlight clip (host or mod)' })
  createClip(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateStreamClipDto,
  ) {
    return this.streamLiveService.createClip(id, user.sub, dto, user.role);
  }

  @Public()
  @Get(':id/captions')
  @ApiOperation({ summary: 'List captions/subtitles for stream replay' })
  listCaptions(@Param('id') id: string) {
    return this.streamLiveService.listCaptions(id);
  }

  @Public()
  @Post('webhooks/mux')
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
