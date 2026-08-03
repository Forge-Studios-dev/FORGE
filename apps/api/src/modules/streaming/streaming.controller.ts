import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
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
import { StreamReactionService } from './stream-reaction.service';
import { StreamAnalyticsService } from './stream-analytics.service';
import { AiCommunityService } from '../communities/ai-community.service';
import { AudienceRequestType } from './entities/stream-audience-request.entity';
import { StreamBreakoutService } from './stream-breakout.service';

@ApiTags('Streaming')
@Controller('streams')
export class StreamingController {
  constructor(
    private readonly streamingService: StreamingService,
    private readonly streamLiveService: StreamLiveService,
    private readonly configService: ConfigService,
    private readonly billingService: BillingService,
    private readonly usersService: UsersService,
    private readonly streamReactionService: StreamReactionService,
    private readonly streamAnalyticsService: StreamAnalyticsService,
    private readonly aiCommunityService: AiCommunityService,
    private readonly streamBreakoutService: StreamBreakoutService,
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
  async getLiveStreams(
    @CurrentUser() user?: JwtPayload,
    @Query('creatorId') creatorId?: string,
  ) {
    return this.streamingService.getLiveStreams(user?.sub, user?.role, creatorId);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('upcoming')
  @ApiOperation({ summary: 'Get scheduled upcoming streams' })
  async getUpcomingStreams(
    @CurrentUser() user?: JwtPayload,
    @Query('creatorId') creatorId?: string,
  ) {
    return this.streamingService.getUpcomingStreams(user?.sub, user?.role, creatorId);
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
  @Get(':id/reactions')
  @ApiOperation({ summary: 'Get live reaction counts for a stream' })
  getReactions(@Param('id') id: string) {
    return this.streamReactionService.getCounts(id);
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

  @Post(':id/raise-hand')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Raise hand during live stream (stage mode)' })
  raiseHand(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.streamLiveService.raiseHand(id, user.sub);
  }

  @Delete(':id/raise-hand')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lower raised hand' })
  lowerHand(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.streamLiveService.lowerHand(id, user.sub);
  }

  @Get(':id/raise-hands')
  @ApiOperation({ summary: 'List raised hands for stream' })
  listRaisedHands(@Param('id') id: string) {
    return this.streamLiveService.listRaisedHands(id);
  }

  // ── Audience Requests (P07-T027: audience requests, P07-T031: guest speakers) ──

  @Post(':id/requests')
  @ApiOperation({ summary: 'Submit an audience request (question or speak/guest request)' })
  createAudienceRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { requestType?: AudienceRequestType; message?: string },
  ) {
    return this.streamLiveService.createAudienceRequest(
      id,
      user.sub,
      body.requestType ?? AudienceRequestType.QUESTION,
      body.message,
    );
  }

  @Delete(':id/requests/me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Withdraw my audience request' })
  withdrawAudienceRequest(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.streamLiveService.withdrawAudienceRequest(id, user.sub);
  }

  @UseGuards(CreatorApprovedGuard)
  @Get(':id/requests')
  @ApiOperation({ summary: "List audience requests for creator's stream" })
  listAudienceRequests(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.streamLiveService.listAudienceRequests(id, user.sub);
  }

  @UseGuards(CreatorApprovedGuard)
  @Patch(':id/requests/:requestId')
  @ApiOperation({ summary: 'Approve or reject an audience request' })
  respondToAudienceRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() body: { approve: boolean },
  ) {
    return this.streamLiveService.respondToAudienceRequest(id, requestId, user.sub, body.approve);
  }

  @Get(':id/ai-summary')
  @ApiOperation({ summary: 'AI-generated summary of a live stream' })
  async getStreamAiSummary(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const stream = await this.streamingService.getStreamForViewer(id, user.sub, user.role);
    const chatMessages = await this.streamAnalyticsService.getStreamChatMessages(id, 200);
    return this.aiCommunityService.generateStreamSummary({
      title: stream.title,
      chatMessages,
      peakViewers: stream.viewerCount ?? undefined,
    });
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

  // ── P07-T028: Breakout rooms ───────────────────────────────────────────────

  @UseGuards(CreatorApprovedGuard)
  @Post(':id/breakout-rooms')
  @ApiOperation({ summary: 'Create breakout rooms from a live stream (creator)' })
  createBreakoutRooms(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { roomCount: number; durationMinutes: number; maxParticipantsPerRoom?: number; namingPrefix?: string },
  ) {
    return this.streamBreakoutService.createBreakoutRooms(user.sub, id, body);
  }

  @UseGuards(CreatorApprovedGuard)
  @Get(':id/breakout-rooms')
  @ApiOperation({ summary: 'List active breakout rooms for a stream' })
  listBreakoutRooms(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { communityId: string },
  ) {
    return this.streamBreakoutService.listBreakoutRooms(id, body.communityId);
  }

  @UseGuards(CreatorApprovedGuard)
  @Post(':id/breakout-rooms/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Auto-assign participants to breakout rooms (creator)' })
  assignBreakout(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { communityId: string; roomIds: string[] },
  ) {
    return this.streamBreakoutService.assignParticipants(user.sub, id, body.communityId, body.roomIds);
  }

  @UseGuards(CreatorApprovedGuard)
  @Post(':id/breakout-rooms/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End all breakout rooms and return participants to main stream' })
  endBreakoutRooms(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { roomIds: string[] },
  ) {
    return this.streamBreakoutService.endBreakoutRooms(user.sub, id, body.roomIds).then(() => ({ ok: true }));
  }

  // ── P07-T029: Multi-host live ──────────────────────────────────────────────

  @UseGuards(CreatorApprovedGuard)
  @Get(':id/co-hosts')
  @ApiOperation({ summary: 'List co-hosts for a stream' })
  listCoHosts(@Param('id') id: string) {
    return this.streamingService.listCoHosts(id);
  }

  @UseGuards(CreatorApprovedGuard)
  @Post(':id/co-hosts')
  @ApiOperation({ summary: 'Add a co-host to the stream (creator only)' })
  addCoHost(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    return this.streamingService.addCoHost(user.sub, id, body.userId);
  }

  @UseGuards(CreatorApprovedGuard)
  @Delete(':id/co-hosts/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a co-host from the stream (creator only)' })
  removeCoHost(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('userId') coHostId: string,
  ) {
    return this.streamingService.removeCoHost(user.sub, id, coHostId);
  }

  // ── P07-T030: VIP rooms live ───────────────────────────────────────────────

  @UseGuards(CreatorApprovedGuard)
  @Patch(':id/vip-config')
  @ApiOperation({ summary: 'Configure VIP room tier for a stream (creator only)' })
  setVipTier(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { vipTierId: string | null },
  ) {
    return this.streamingService.setVipTier(user.sub, id, body.vipTierId ?? null);
  }

  @Post(':id/vip-room/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify VIP room access and get join token' })
  async joinVipRoom(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.streamingService.assertVipAccess(id, user.sub, user.role);
    return { streamId: id, vipRoom: `stream:${id}:vip`, access: 'granted' };
  }
}
