import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  StreamMessage,
  StreamMessageType,
  StreamQuestionStatus,
} from './entities/stream-message.entity';
import { StreamModerationAction } from './entities/stream-moderation-action.entity';
import { SendStreamChatDto, TimeoutUserDto } from './dto/stream-chat.dto';
import { SubmitQuestionDto } from './dto/stream-qa.dto';
import { SendSuperChatDto } from './dto/send-super-chat.dto';
import { toPublicStreamMessage, toPublicStreamQuestion } from './stream-chat.mapper';
import { Stream, StreamChatMode, StreamStatus, StreamVisibility } from '../streaming/entities/stream.entity';
import { StreamingService } from '../streaming/streaming.service';
import { SetStreamChatSettingsDto } from '../streaming/dto/set-stream-chat-settings.dto';
import { StreamLiveService } from '../streaming/stream-live.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EngagementService } from '../engagement/engagement.service';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import {
  safeRedisDel,
  safeRedisGet,
  safeRedisSetNx,
  safeRedisSetex,
} from '../../common/redis/redis-safe.util';
import {
  bustModerationCache,
  getCachedModerationStatus,
  setCachedModerationStatus,
} from '../../common/streaming/stream-moderation-cache.util';
import { incrementStreamChatMinuteCounter } from '../../common/streaming/stream-chat-minute-counter.util';
import { ConfigService } from '@nestjs/config';
import { maskProfanity } from '../../common/chat/profanity-filter.util';
import { computeStreamOffsetMs } from '../../common/chat/stream-offset.util';
import { moderateChatMessage } from '../../common/chat/ai-moderation.util';
import { OnEvent } from '@nestjs/event-emitter';
import { STREAM_CHAT_INGEST_QUEUE } from '../workers/stream-chat-ingest/stream-chat-ingest.constants';
import type { StreamChatIngestJob } from '../workers/stream-chat-ingest/stream-chat-ingest.worker';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class StreamChatService {
  private readonly logger = new Logger(StreamChatService.name);

  constructor(
    @InjectRepository(StreamMessage)
    private readonly messageRepository: Repository<StreamMessage>,
    @InjectRepository(StreamModerationAction)
    private readonly moderationRepository: Repository<StreamModerationAction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly streamingService: StreamingService,
    private readonly streamLiveService: StreamLiveService,
    private readonly entitlementsService: EntitlementsService,
    private readonly engagementService: EngagementService,
    private readonly usersService: UsersService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    @InjectQueue(STREAM_CHAT_INGEST_QUEUE)
    private readonly chatIngestQueue: Queue<StreamChatIngestJob>,
    @Inject(forwardRef(() => BillingService))
    private readonly billingService: BillingService,
  ) {}

  async getMessages(
    streamId: string,
    limit = 50,
    cursor?: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
    replayWindow?: { fromMs?: number; toMs?: number },
  ) {
    const stream = await this.streamingService.findById(streamId);
    await this.assertNotBlockedFromHost(stream, viewerId, viewerRole);
    const isOwner = !!viewerId && viewerId === stream.userId;
    const isAdmin = viewerRole === UserRole.ADMIN;
    const isMod = viewerId
      ? await this.streamLiveService.canModerate(streamId, viewerId, viewerRole, stream)
      : false;

    if (!stream.chatEnabled) {
      throw new ForbiddenException('Chat is disabled for this stream');
    }

    if (!isOwner && !isAdmin && !isMod) {
      await this.entitlementsService.assertAccessAsync({
        creatorId: stream.userId,
        visibility: stream.visibility,
        requiredTierId: stream.requiredTierId,
        streamId: stream.id,
        viewerId,
      });
    }

    const isReplayQuery =
      replayWindow?.fromMs != null ||
      replayWindow?.toMs != null;

    if (!cursor && !isReplayQuery) {
      const cacheKey = `stream:chat:page:${streamId}`;
      const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
      if (cached) {
        try {
          return JSON.parse(cached) as {
            data: ReturnType<typeof toPublicStreamMessage>[];
            meta: { cursor: string | null; hasMore: boolean };
          };
        } catch {
          await safeRedisDel(this.redis, cacheKey, this.logger);
        }
      }
    }

    if (isReplayQuery) {
      const qb = this.messageRepository
        .createQueryBuilder('m')
        .leftJoinAndSelect('m.user', 'user')
        .where('m.stream_id = :streamId', { streamId })
        .andWhere('m.deleted_at IS NULL')
        .andWhere('m.stream_offset_ms IS NOT NULL');

      if (replayWindow.fromMs != null) {
        qb.andWhere('m.stream_offset_ms >= :fromMs', { fromMs: replayWindow.fromMs });
      }
      if (replayWindow.toMs != null) {
        qb.andWhere('m.stream_offset_ms <= :toMs', { toMs: replayWindow.toMs });
      }

      const messages = await qb
        .orderBy('m.stream_offset_ms', 'ASC')
        .take(Math.min(limit, 500))
        .getMany();

      return {
        data: messages.map(toPublicStreamMessage),
        meta: { cursor: null, hasMore: false },
      };
    }

    const cursorDate = cursor
      ? new Date(Buffer.from(cursor, 'base64').toString('utf-8'))
      : undefined;

    const messages = await this.messageRepository.find({
      where: cursorDate
        ? { streamId, createdAt: LessThan(cursorDate) }
        : { streamId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit + 1,
    });
    const hasMore = messages.length > limit;
    const data = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore
      ? Buffer.from(data[data.length - 1].createdAt.toISOString()).toString('base64')
      : null;

    const result = {
      data: data.reverse().map(toPublicStreamMessage),
      meta: { cursor: nextCursor, hasMore },
    };

    if (!cursor) {
      await safeRedisSetex(this.redis, `stream:chat:page:${streamId}`, 5, JSON.stringify(result), this.logger);
    }

    return result;
  }

  async sendMessage(
    streamId: string,
    userId: string,
    dto: SendStreamChatDto,
    viewerRole?: UserRole | null,
  ) {
    const stream = await this.streamingService.findById(streamId);
    await this.assertNotBlockedFromHost(stream, userId, viewerRole);
    if (!stream.chatEnabled) {
      throw new ForbiddenException('Chat is disabled for this stream');
    }

    const isOwner = userId === stream.userId;
    const isAdmin = viewerRole === UserRole.ADMIN;
    const isMod = await this.streamLiveService.canModerate(streamId, userId, viewerRole, stream);

    if (!isOwner && !isAdmin && !isMod) {
      await this.entitlementsService.assertAccessAsync({
        creatorId: stream.userId,
        visibility: stream.visibility,
        requiredTierId: stream.requiredTierId,
        streamId: stream.id,
        viewerId: userId,
      });
      await this.assertChatParticipation(stream, userId, viewerRole);
    }

    await this.assertNotModerated(streamId, userId);
    await this.assertRateLimit(streamId, userId, stream.slowModeSeconds);

    const profanityEnabled =
      this.configService.get<string>('stream.profanityFilterEnabled') !== 'false';
    const body = maskProfanity(dto.body.trim(), profanityEnabled);
    await this.assertAiModeration(body);

    const streamOffsetMs = computeStreamOffsetMs(stream);

    const useAsync =
      this.configService.get<boolean>('stream.chatAsync') ??
      this.configService.get<string>('nodeEnv') === 'production';

    if (useAsync) {
      const messageId = randomUUID();
      await this.chatIngestQueue.add(
        'ingest',
        {
          streamId,
          userId,
          body,
          parentId: dto.parentId ?? null,
          messageId,
          streamOffsetMs,
          messageType: StreamMessageType.CHAT,
        },
        { jobId: `chat-${messageId}` },
      );

      const user = await this.userRepository.findOne({ where: { id: userId } });
      return {
        id: messageId,
        streamId,
        userId,
        body,
        parentId: dto.parentId ?? null,
        streamOffsetMs,
        messageType: StreamMessageType.CHAT,
        createdAt: new Date().toISOString(),
        user: user
          ? {
              id: user.id,
              displayName: user.displayName,
              username: user.username,
              avatarUrl: user.avatarUrl,
            }
          : undefined,
      };
    }

    return this.persistAndEmitMessage({
      streamId,
      userId,
      body,
      parentId: dto.parentId ?? null,
      streamOffsetMs,
      messageType: StreamMessageType.CHAT,
    });
  }

  async sendSuperChat(
    streamId: string,
    userId: string,
    dto: SendSuperChatDto,
    viewerRole?: UserRole | null,
  ) {
    if (this.configService.get<boolean>('stream.superChatEnabled') === false) {
      throw new BadRequestException('Super chat is disabled');
    }

    const min = this.configService.get<number>('stream.superChatMinCents') ?? 100;
    const max = this.configService.get<number>('stream.superChatMaxCents') ?? 50_000;
    if (dto.amountCents < min || dto.amountCents > max) {
      throw new BadRequestException(`Super chat amount must be between ${min} and ${max} cents`);
    }

    const stream = await this.streamingService.findById(streamId);
    await this.assertNotBlockedFromHost(stream, userId, viewerRole);
    if (!stream.chatEnabled) {
      throw new ForbiddenException('Chat is disabled for this stream');
    }
    if (stream.status !== StreamStatus.LIVE) {
      throw new BadRequestException('Super chat is only available during live streams');
    }
    if (stream.muxIdleSince) {
      throw new BadRequestException('Super chat is paused while the host is reconnecting');
    }

    const isOwner = userId === stream.userId;
    const isAdmin = viewerRole === UserRole.ADMIN;
    const isMod = await this.streamLiveService.canModerate(streamId, userId, viewerRole, stream);

    if (!isOwner && !isAdmin && !isMod) {
      await this.entitlementsService.assertAccessAsync({
        creatorId: stream.userId,
        visibility: stream.visibility,
        requiredTierId: stream.requiredTierId,
        streamId: stream.id,
        viewerId: userId,
      });
      await this.assertChatParticipation(stream, userId, viewerRole);
    }

    await this.assertNotModerated(streamId, userId);

    if (this.billingService.isBillingEnabled() && dto.successUrl && dto.cancelUrl) {
      const session = await this.billingService.createSuperChatCheckout(userId, {
        streamId,
        body: dto.body.trim(),
        amountCents: dto.amountCents,
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl,
      });
      return {
        ok: true,
        requiresCheckout: true,
        checkoutUrl: session.checkoutUrl,
        sessionId: session.sessionId,
      };
    }

    const highlightSeconds =
      this.configService.get<number>('stream.superChatHighlightSeconds') ?? 120;
    const profanityEnabled =
      this.configService.get<string>('stream.profanityFilterEnabled') !== 'false';
    const body = maskProfanity(dto.body.trim(), profanityEnabled);
    await this.assertAiModeration(body);

    return this.persistAndEmitMessage({
      streamId,
      userId,
      body,
      streamOffsetMs: computeStreamOffsetMs(stream),
      messageType: StreamMessageType.SUPER_CHAT,
      amountCents: dto.amountCents,
      highlightSeconds,
      ...this.computeSuperChatFeeSplit(dto.amountCents),
    });
  }

  /** Same platform-fee-percent config Super Thanks uses (billing.stripePlatformFeePercent). */
  private computeSuperChatFeeSplit(amountCents: number) {
    const platformFeePercent =
      this.configService.get<number>('billing.stripePlatformFeePercent') ?? 10;
    const platformFeeCents = Math.round((amountCents * platformFeePercent) / 100);
    const creatorNetCents = Math.max(0, amountCents - platformFeeCents);
    return { platformFeePercent, platformFeeCents, creatorNetCents };
  }

  @OnEvent('stream.super-chat.paid')
  async handleSuperChatPaid(payload: {
    streamId: string;
    userId: string;
    body: string;
    amountCents: number;
    stripeCheckoutSessionId?: string | null;
  }) {
    // Checkout can complete after the stream ended or entered the reconnect
    // grace window (payment already captured by Stripe before this event
    // fires). Posting the message into a dead/paused room would be visibly
    // wrong, so skip persisting it and flag for manual reconciliation rather
    // than silently attaching a "super chat" to nothing.
    const stream = await this.streamingService.findById(payload.streamId);
    if (stream.status !== StreamStatus.LIVE || stream.muxIdleSince) {
      this.logger.warn(
        `Super chat paid for stream ${payload.streamId} but stream is ${stream.status}${stream.muxIdleSince ? ' (reconnecting)' : ''} — payment captured but message not posted; needs manual reconciliation (user=${payload.userId}, amountCents=${payload.amountCents})`,
      );
      return;
    }
    const profanityEnabled =
      this.configService.get<string>('stream.profanityFilterEnabled') !== 'false';
    const body = maskProfanity(payload.body.trim(), profanityEnabled);
    const highlightSeconds =
      this.configService.get<number>('stream.superChatHighlightSeconds') ?? 120;

    await this.persistAndEmitMessage({
      streamId: payload.streamId,
      userId: payload.userId,
      body,
      streamOffsetMs: computeStreamOffsetMs(stream),
      messageType: StreamMessageType.SUPER_CHAT,
      amountCents: payload.amountCents,
      highlightSeconds,
      stripeCheckoutSessionId: payload.stripeCheckoutSessionId ?? null,
      ...this.computeSuperChatFeeSplit(payload.amountCents),
    });
  }

  // ── Live Q&A ──────────────────────────────────────────────────────────────
  // Reuses the stream_messages table (messageType = 'question') so questions
  // inherit the same access, moderation, profanity, and rate-limit guards as
  // chat. Questions are persisted synchronously (low volume vs. chat) and fanned
  // out via dedicated `stream.qa.*` events.

  /** Block either way — same gate as live stream detail / socket join. */
  private async assertNotBlockedFromHost(
    stream: Stream,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ): Promise<void> {
    if (!viewerId) return;
    if (viewerId === stream.userId || viewerRole === UserRole.ADMIN) return;
    if (await this.engagementService.isBlockedEitherWay(viewerId, stream.userId)) {
      throw new ForbiddenException('This stream is not available');
    }
  }

  /** Shared read-side gating: a viewer may see Q&A iff they could see chat. */
  private async assertCanViewStream(
    stream: Stream,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ): Promise<void> {
    await this.assertNotBlockedFromHost(stream, viewerId, viewerRole);
    if (!stream.chatEnabled) {
      throw new ForbiddenException('Chat is disabled for this stream');
    }
    const isOwner = !!viewerId && viewerId === stream.userId;
    const isAdmin = viewerRole === UserRole.ADMIN;
    const isMod = viewerId
      ? await this.streamLiveService.canModerate(stream.id, viewerId, viewerRole, stream)
      : false;
    if (isOwner || isAdmin || isMod) return;
    await this.entitlementsService.assertAccessAsync({
      creatorId: stream.userId,
      visibility: stream.visibility,
      requiredTierId: stream.requiredTierId,
      streamId: stream.id,
      viewerId,
    });
  }

  async submitQuestion(
    streamId: string,
    userId: string,
    dto: SubmitQuestionDto,
    viewerRole?: UserRole | null,
  ) {
    const stream = await this.streamingService.findById(streamId);
    await this.assertNotBlockedFromHost(stream, userId, viewerRole);
    if (!stream.chatEnabled) {
      throw new ForbiddenException('Chat is disabled for this stream');
    }

    const isOwner = userId === stream.userId;
    const isAdmin = viewerRole === UserRole.ADMIN;
    const isMod = await this.streamLiveService.canModerate(streamId, userId, viewerRole, stream);
    if (!isOwner && !isAdmin && !isMod) {
      await this.entitlementsService.assertAccessAsync({
        creatorId: stream.userId,
        visibility: stream.visibility,
        requiredTierId: stream.requiredTierId,
        streamId: stream.id,
        viewerId: userId,
      });
      await this.assertChatParticipation(stream, userId, viewerRole);
    }

    await this.assertNotModerated(streamId, userId);
    // Questions are rate-limited more strictly than chat to keep the queue clean.
    await this.assertRateLimit(streamId, userId, Math.max(stream.slowModeSeconds ?? 0, 10));

    const profanityEnabled =
      this.configService.get<string>('stream.profanityFilterEnabled') !== 'false';
    const body = maskProfanity(dto.body.trim(), profanityEnabled);
    await this.assertAiModeration(body);

    const saved = await this.messageRepository.save(
      this.messageRepository.create({
        streamId,
        userId,
        body,
        messageType: StreamMessageType.QUESTION,
        questionStatus: StreamQuestionStatus.PENDING,
        upvotes: 0,
        streamOffsetMs: computeStreamOffsetMs(stream),
      }),
    );
    const full = await this.messageRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });
    const question = toPublicStreamQuestion(full!, false);
    this.eventEmitter.emit('stream.qa.created', { streamId, question });
    return question;
  }

  async listQuestions(
    streamId: string,
    status: StreamQuestionStatus | undefined,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    const stream = await this.streamingService.findById(streamId);
    await this.assertCanViewStream(stream, viewerId, viewerRole);

    const qb = this.messageRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .where('m.stream_id = :streamId', { streamId })
      .andWhere('m.message_type = :type', { type: StreamMessageType.QUESTION })
      .andWhere('m.deleted_at IS NULL');
    if (status) qb.andWhere('m.question_status = :status', { status });

    const rows = await qb
      .orderBy('m.upvotes', 'DESC')
      .addOrderBy('m.created_at', 'ASC')
      .take(100)
      .getMany();

    const voted = await this.getViewerUpvotes(rows.map((r) => r.id), viewerId);
    return { data: rows.map((r) => toPublicStreamQuestion(r, voted.has(r.id))) };
  }

  async upvoteQuestion(
    streamId: string,
    questionId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ) {
    const stream = await this.streamingService.findById(streamId);
    await this.assertCanViewStream(stream, userId, viewerRole);

    const question = await this.messageRepository.findOne({
      where: { id: questionId, streamId, messageType: StreamMessageType.QUESTION },
    });
    if (!question || question.deletedAt) throw new NotFoundException('Question not found');

    const key = `stream:qa:votes:${questionId}`;
    let viewerHasUpvoted: boolean;
    try {
      const added = await this.redis.sadd(key, userId);
      if (added === 1) {
        await this.redis.expire(key, 60 * 60 * 12);
        await this.messageRepository.increment({ id: questionId }, 'upvotes', 1);
        viewerHasUpvoted = true;
      } else {
        await this.redis.srem(key, userId);
        // Clamp at zero so a lost Redis set can never drive the tally negative.
        await this.messageRepository
          .createQueryBuilder()
          .update(StreamMessage)
          .set({ upvotes: () => 'GREATEST(upvotes - 1, 0)' })
          .where('id = :id', { id: questionId })
          .execute();
        viewerHasUpvoted = false;
      }
    } catch (err) {
      this.logger.warn(`Q&A upvote failed for ${questionId}: ${String(err)}`);
      throw new BadRequestException('Could not register vote');
    }

    const fresh = await this.messageRepository.findOne({
      where: { id: questionId },
      relations: ['user'],
    });
    const result = toPublicStreamQuestion(fresh!, viewerHasUpvoted);
    this.eventEmitter.emit('stream.qa.updated', { streamId, question: result });
    return result;
  }

  async setQuestionStatus(
    streamId: string,
    questionId: string,
    status: StreamQuestionStatus,
    requesterId: string,
    requesterRole?: UserRole | null,
  ) {
    if (!(await this.streamLiveService.canModerate(streamId, requesterId, requesterRole))) {
      throw new ForbiddenException();
    }
    const question = await this.messageRepository.findOne({
      where: { id: questionId, streamId, messageType: StreamMessageType.QUESTION },
    });
    if (!question) throw new NotFoundException('Question not found');

    question.questionStatus = status;
    await this.messageRepository.save(question);

    const fresh = await this.messageRepository.findOne({
      where: { id: questionId },
      relations: ['user'],
    });
    const result = toPublicStreamQuestion(fresh!);
    this.eventEmitter.emit('stream.qa.updated', { streamId, question: result });
    return result;
  }

  /** Resolve which of the given questions the viewer has upvoted (best-effort). */
  private async getViewerUpvotes(
    questionIds: string[],
    viewerId?: string | null,
  ): Promise<Set<string>> {
    const voted = new Set<string>();
    if (!viewerId || !questionIds.length) return voted;
    try {
      const pipeline = this.redis.pipeline();
      for (const id of questionIds) pipeline.sismember(`stream:qa:votes:${id}`, viewerId);
      const results = await pipeline.exec();
      results?.forEach(([, isMember], i) => {
        if (isMember === 1) voted.add(questionIds[i]);
      });
    } catch (err) {
      this.logger.warn(`Q&A vote lookup failed: ${String(err)}`);
    }
    return voted;
  }

  private async persistAndEmitMessage(input: {
    streamId: string;
    userId: string;
    body: string;
    parentId?: string | null;
    messageId?: string;
    streamOffsetMs?: number | null;
    messageType?: StreamMessageType;
    amountCents?: number | null;
    highlightSeconds?: number | null;
    platformFeePercent?: number | null;
    platformFeeCents?: number | null;
    creatorNetCents?: number | null;
    stripeCheckoutSessionId?: string | null;
  }) {
    const msg = this.messageRepository.create({
      id: input.messageId,
      streamId: input.streamId,
      userId: input.userId,
      body: input.body,
      parentId: input.parentId ?? null,
      streamOffsetMs: input.streamOffsetMs ?? null,
      messageType: input.messageType ?? StreamMessageType.CHAT,
      amountCents: input.amountCents ?? null,
      highlightSeconds: input.highlightSeconds ?? null,
      platformFeePercent: input.platformFeePercent ?? null,
      platformFeeCents: input.platformFeeCents ?? null,
      creatorNetCents: input.creatorNetCents ?? null,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
    });
    const saved = await this.messageRepository.save(msg);
    const full = await this.messageRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    const publicMsg = toPublicStreamMessage(full!);
    await safeRedisDel(this.redis, `stream:chat:page:${input.streamId}`, this.logger);
    void incrementStreamChatMinuteCounter(this.redis, input.streamId, this.logger);
    this.eventEmitter.emit('stream.chat.message', { streamId: input.streamId, message: publicMsg });
    return publicMsg;
  }

  private async assertAiModeration(body: string): Promise<void> {
    const result = await moderateChatMessage(body, {
      enabled: this.configService.get<boolean>('stream.aiModerationEnabled') !== false,
      openAiKey: this.configService.get<string>('openai.apiKey'),
    });
    if (!result.allowed) {
      throw new ForbiddenException('Message blocked by moderation policy');
    }
  }

  async deleteMessage(
    streamId: string,
    messageId: string,
    requesterId: string,
    requesterRole?: UserRole | null,
  ) {
    await this.streamingService.findById(streamId);
    const msg = await this.messageRepository.findOne({ where: { id: messageId, streamId } });
    if (!msg) throw new NotFoundException('Message not found');

    const canMod =
      requesterId === msg.userId ||
      (await this.streamLiveService.canModerate(streamId, requesterId, requesterRole));
    if (!canMod) throw new ForbiddenException();

    msg.deletedAt = new Date();
    await this.messageRepository.save(msg);
    this.eventEmitter.emit('stream.chat.delete', { streamId, messageId });
    return { ok: true };
  }

  async timeoutUser(
    streamId: string,
    requesterId: string,
    dto: TimeoutUserDto,
    requesterRole?: UserRole | null,
  ) {
    if (!(await this.streamLiveService.canModerate(streamId, requesterId, requesterRole))) {
      throw new ForbiddenException();
    }

    const duration = dto.durationSeconds ?? 300;
    const expiresAt = new Date(Date.now() + duration * 1000);
    const targetUserId = await this.usersService.resolveUserId({
      userId: dto.targetUserId,
      username: dto.targetUsername,
    });

    await this.moderationRepository.save(
      this.moderationRepository.create({
        streamId,
        targetUserId,
        action: 'timeout',
        expiresAt,
        createdById: requesterId,
      }),
    );
    void bustModerationCache(this.redis, streamId, targetUserId, this.logger);

    return { ok: true, expiresAt };
  }

  async banUser(
    streamId: string,
    requesterId: string,
    dto: TimeoutUserDto,
    requesterRole?: UserRole | null,
  ) {
    if (!(await this.streamLiveService.canModerate(streamId, requesterId, requesterRole))) {
      throw new ForbiddenException();
    }

    const targetUserId = await this.usersService.resolveUserId({
      userId: dto.targetUserId,
      username: dto.targetUsername,
    });

    await this.moderationRepository.save(
      this.moderationRepository.create({
        streamId,
        targetUserId,
        action: 'ban',
        expiresAt: null,
        createdById: requesterId,
      }),
    );
    void bustModerationCache(this.redis, streamId, targetUserId, this.logger);

    return { ok: true };
  }

  async setPinnedMessage(
    streamId: string,
    requesterId: string,
    messageId: string | null,
    requesterRole?: UserRole | null,
  ) {
    if (!(await this.streamLiveService.canModerate(streamId, requesterId, requesterRole))) {
      throw new ForbiddenException();
    }

    if (messageId) {
      const msg = await this.messageRepository.findOne({ where: { id: messageId, streamId } });
      if (!msg) throw new NotFoundException('Message not found');
    }

    await this.streamingService.setPinnedMessage(requesterId, streamId, messageId, {
      isAdmin: requesterRole === UserRole.ADMIN,
      allowModerator: true,
    });
    return { ok: true, pinnedMessageId: messageId };
  }

  async setSlowMode(
    streamId: string,
    requesterId: string,
    slowModeSeconds: number,
    requesterRole?: UserRole | null,
  ) {
    if (!(await this.streamLiveService.canModerate(streamId, requesterId, requesterRole))) {
      throw new ForbiddenException();
    }
    await this.streamingService.setSlowMode(requesterId, streamId, slowModeSeconds, {
      allowModerator: true,
    });
    return { ok: true, slowModeSeconds };
  }

  async setChatSettings(
    streamId: string,
    requesterId: string,
    dto: SetStreamChatSettingsDto,
    requesterRole?: UserRole | null,
  ) {
    if (!(await this.streamLiveService.canModerate(streamId, requesterId, requesterRole))) {
      throw new ForbiddenException();
    }

    const saved = await this.streamingService.updateChatSettings(streamId, {
      chatEnabled: dto.chatEnabled,
      chatMode: dto.chatMode,
    });

    return {
      ok: true,
      chatEnabled: saved.chatEnabled,
      chatMode: saved.chatMode,
    };
  }

  async unbanUser(
    streamId: string,
    requesterId: string,
    dto: TimeoutUserDto,
    requesterRole?: UserRole | null,
  ) {
    if (!(await this.streamLiveService.canModerate(streamId, requesterId, requesterRole))) {
      throw new ForbiddenException();
    }

    const targetUserId = await this.usersService.resolveUserId({
      userId: dto.targetUserId,
      username: dto.targetUsername,
    });

    await this.moderationRepository.delete({
      streamId,
      targetUserId,
      action: 'ban',
    });
    void bustModerationCache(this.redis, streamId, targetUserId, this.logger);

    return { ok: true };
  }

  private async assertChatParticipation(
    stream: Stream,
    userId: string,
    viewerRole?: UserRole | null,
  ): Promise<void> {
    const mode = stream.chatMode ?? StreamChatMode.ALL;
    if (mode === StreamChatMode.ALL) return;

    const isOwner = userId === stream.userId;
    const isAdmin = viewerRole === UserRole.ADMIN;
    const isMod = await this.streamLiveService.canModerate(stream.id, userId, viewerRole, stream);
    if (isOwner || isAdmin || isMod) return;

    if (mode === StreamChatMode.MODS_ONLY) {
      throw new ForbiddenException('Only moderators can send messages in this chat');
    }

    if (mode === StreamChatMode.FOLLOWERS) {
      await this.entitlementsService.assertAccessAsync({
        creatorId: stream.userId,
        visibility: StreamVisibility.FOLLOWERS,
        viewerId: userId,
      });
      return;
    }

    if (mode === StreamChatMode.SUBSCRIBERS) {
      await this.entitlementsService.assertAccessAsync({
        creatorId: stream.userId,
        visibility: StreamVisibility.SUBSCRIBERS,
        viewerId: userId,
      });
    }
  }

  private async assertNotModerated(streamId: string, userId: string) {
    const cached = await getCachedModerationStatus(this.redis, streamId, userId, this.logger);
    if (cached === 'ban') {
      throw new ForbiddenException('You are banned from this chat');
    }
    if (cached === 'timeout') {
      throw new ForbiddenException('You are timed out from this chat');
    }
    if (cached === 'ok') return;

    const now = new Date();
    const ban = await this.moderationRepository.findOne({
      where: { streamId, targetUserId: userId, action: 'ban' },
      order: { createdAt: 'DESC' },
    });
    if (ban) {
      await setCachedModerationStatus(this.redis, streamId, userId, 'ban', 300, this.logger);
      throw new ForbiddenException('You are banned from this chat');
    }

    const timeout = await this.moderationRepository.findOne({
      where: {
        streamId,
        targetUserId: userId,
        action: 'timeout',
        expiresAt: MoreThan(now),
      },
      order: { createdAt: 'DESC' },
    });
    if (timeout) {
      const ttlSec = Math.max(
        10,
        Math.ceil((timeout.expiresAt!.getTime() - now.getTime()) / 1000),
      );
      await setCachedModerationStatus(this.redis, streamId, userId, 'timeout', ttlSec, this.logger);
      throw new ForbiddenException('You are timed out from this chat');
    }

    await setCachedModerationStatus(this.redis, streamId, userId, 'ok', undefined, this.logger);
  }

  private async assertRateLimit(streamId: string, userId: string, slowModeSeconds: number) {
    const minInterval = Math.max(slowModeSeconds, 2);
    const key = `stream:chat:rate:${streamId}:${userId}`;
    const allowed = await safeRedisSetNx(this.redis, key, '1', minInterval, this.logger);
    if (!allowed) {
      throw new HttpException('Slow down — wait before sending another message', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
