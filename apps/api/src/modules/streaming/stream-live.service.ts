import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { StreamAudienceRequest, AudienceRequestStatus, AudienceRequestType } from './entities/stream-audience-request.entity';
import { StreamModerator } from './entities/stream-moderator.entity';
import { StreamRsvp } from './entities/stream-rsvp.entity';
import { StreamPoll } from './entities/stream-poll.entity';
import { StreamPollVote } from './entities/stream-poll-vote.entity';
import { StreamClip } from './entities/stream-clip.entity';
import { StreamCaption } from './entities/stream-caption.entity';
import { Stream, StreamStatus } from './entities/stream.entity';
import { CreateStreamClipDto } from './dto/create-stream-clip.dto';
import { computeStreamOffsetMs } from '../../common/chat/stream-offset.util';
import { UserRole } from '../users/entities/user.entity';
import { StreamingService } from './streaming.service';
import { muxPlaybackIdFromHlsUrl } from '../../common/media/mux-playback.util';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { UsersService } from '../users/users.service';
import { MuxLiveSyncService } from './mux-live-sync.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class StreamLiveService {
  constructor(
    @InjectRepository(StreamModerator)
    private readonly moderatorRepository: Repository<StreamModerator>,
    @InjectRepository(StreamRsvp)
    private readonly rsvpRepository: Repository<StreamRsvp>,
    @InjectRepository(StreamPoll)
    private readonly pollRepository: Repository<StreamPoll>,
    @InjectRepository(StreamPollVote)
    private readonly pollVoteRepository: Repository<StreamPollVote>,
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @InjectRepository(StreamClip)
    private readonly clipRepository: Repository<StreamClip>,
    @InjectRepository(StreamCaption)
    private readonly captionRepository: Repository<StreamCaption>,
    @InjectRepository(StreamAudienceRequest)
    private readonly audienceRequestRepository: Repository<StreamAudienceRequest>,
    private readonly streamingService: StreamingService,
    private readonly configService: ConfigService,
    private readonly entitlementsService: EntitlementsService,
    private readonly usersService: UsersService,
    private readonly eventEmitter: EventEmitter2,
    private readonly muxLiveSyncService: MuxLiveSyncService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async canModerate(
    streamId: string,
    userId: string,
    role?: UserRole | null,
    stream?: Stream,
  ): Promise<boolean> {
    const resolved = stream ?? (await this.streamingService.findById(streamId));
    if (resolved.userId === userId || role === UserRole.ADMIN) return true;
    const mod = await this.moderatorRepository.findOne({ where: { streamId, userId } });
    return !!mod;
  }

  async listModerators(streamId: string, requesterId: string, role?: UserRole | null) {
    const stream = await this.streamingService.findById(streamId);
    if (stream.userId !== requesterId && role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
    const mods = await this.moderatorRepository.find({
      where: { streamId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    return mods.map((m) => ({
      id: m.id,
      userId: m.userId,
      displayName: m.user?.displayName,
      username: m.user?.username,
      grantedAt: m.createdAt,
    }));
  }

  async addModerator(
    streamId: string,
    requesterId: string,
    target: { userId?: string; username?: string },
    role?: UserRole | null,
  ) {
    const stream = await this.streamingService.findById(streamId);
    if (stream.userId !== requesterId && role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
    const targetUserId = await this.usersService.resolveUserId(target);
    if (targetUserId === stream.userId) {
      throw new BadRequestException('Stream owner is already a moderator');
    }
    const existing = await this.moderatorRepository.findOne({ where: { streamId, userId: targetUserId } });
    if (existing) return existing;

    return this.moderatorRepository.save(
      this.moderatorRepository.create({
        streamId,
        userId: targetUserId,
        grantedByUserId: requesterId,
      }),
    );
  }

  async removeModerator(
    streamId: string,
    requesterId: string,
    targetUserId: string,
    role?: UserRole | null,
  ) {
    const stream = await this.streamingService.findById(streamId);
    if (stream.userId !== requesterId && role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
    await this.moderatorRepository.delete({ streamId, userId: targetUserId });
    return { ok: true };
  }

  async rsvp(streamId: string, userId: string) {
    const stream = await this.streamingService.findById(streamId);
    if (!stream.scheduledAt || stream.status === StreamStatus.ENDED) {
      throw new BadRequestException('This stream is not open for RSVP');
    }
    const existing = await this.rsvpRepository.findOne({ where: { streamId, userId } });
    if (existing) return { ok: true, rsvpCount: await this.rsvpCount(streamId) };

    await this.rsvpRepository.save(this.rsvpRepository.create({ streamId, userId }));
    return { ok: true, rsvpCount: await this.rsvpCount(streamId) };
  }

  async cancelRsvp(streamId: string, userId: string) {
    await this.rsvpRepository.delete({ streamId, userId });
    return { ok: true, rsvpCount: await this.rsvpCount(streamId) };
  }

  async getRsvpStatus(streamId: string, userId?: string | null) {
    const hasRsvp = userId
      ? !!(await this.rsvpRepository.findOne({ where: { streamId, userId } }))
      : false;
    return { rsvpCount: await this.rsvpCount(streamId), hasRsvp };
  }

  async listRsvpUserIds(streamId: string): Promise<string[]> {
    const rows = await this.rsvpRepository.find({
      where: { streamId },
      select: ['userId'],
      take: 1000,
      order: { createdAt: 'ASC' },
    });
    return rows.map((r) => r.userId);
  }

  private async rsvpCount(streamId: string): Promise<number> {
    return this.rsvpRepository.count({ where: { streamId } });
  }

  async createPoll(
    streamId: string,
    userId: string,
    input: { question: string; options: string[] },
    role?: UserRole | null,
  ) {
    if (!(await this.canModerate(streamId, userId, role))) {
      throw new ForbiddenException();
    }
    const options = input.options.map((o) => o.trim()).filter(Boolean);
    if (options.length < 2 || options.length > 6) {
      throw new BadRequestException('Polls need 2–6 options');
    }

    await this.pollRepository.update({ streamId, isActive: true }, { isActive: false, closedAt: new Date() });

    const poll = await this.pollRepository.save(
      this.pollRepository.create({
        streamId,
        question: input.question.trim(),
        options,
        isActive: true,
        createdByUserId: userId,
      }),
    );

    const payload = await this.toPublicPoll(poll.id);
    this.eventEmitter.emit('stream.poll.updated', { streamId, poll: payload });
    return payload;
  }

  async votePoll(pollId: string, userId: string, optionIndex: number) {
    const poll = await this.pollRepository.findOne({ where: { id: pollId, isActive: true } });
    if (!poll) throw new NotFoundException('Poll not found');
    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      throw new BadRequestException('Invalid option');
    }

    const stream = await this.streamingService.findById(poll.streamId);
    const isOwner = userId === stream.userId;
    if (!isOwner) {
      await this.entitlementsService.assertAccessAsync({
        creatorId: stream.userId,
        visibility: stream.visibility,
        requiredTierId: stream.requiredTierId,
        streamId: stream.id,
        viewerId: userId,
      });
    }

    const existing = await this.pollVoteRepository.findOne({ where: { pollId, userId } });
    if (existing) {
      existing.optionIndex = optionIndex;
      await this.pollVoteRepository.save(existing);
    } else {
      await this.pollVoteRepository.save(
        this.pollVoteRepository.create({ pollId, userId, optionIndex }),
      );
    }

    const payload = await this.toPublicPoll(pollId);
    this.eventEmitter.emit('stream.poll.updated', { streamId: poll.streamId, poll: payload });
    return payload;
  }

  async getActivePoll(streamId: string) {
    const poll = await this.pollRepository.findOne({
      where: { streamId, isActive: true },
      order: { createdAt: 'DESC' },
    });
    if (!poll) return null;
    return this.toPublicPoll(poll.id);
  }

  async closePoll(streamId: string, pollId: string, userId: string, role?: UserRole | null) {
    if (!(await this.canModerate(streamId, userId, role))) {
      throw new ForbiddenException();
    }
    await this.pollRepository.update({ id: pollId, streamId }, { isActive: false, closedAt: new Date() });
    this.eventEmitter.emit('stream.poll.updated', { streamId, poll: null });
    return { ok: true };
  }

  private async toPublicPoll(pollId: string) {
    const poll = await this.pollRepository.findOne({ where: { id: pollId } });
    if (!poll) throw new NotFoundException('Poll not found');

    const voteRows = await this.pollVoteRepository
      .createQueryBuilder('v')
      .select('v.option_index', 'optionIndex')
      .addSelect('COUNT(*)', 'count')
      .where('v.poll_id = :pollId', { pollId })
      .groupBy('v.option_index')
      .getRawMany<{ optionIndex: number; count: string }>();

    const countByOption = new Map(
      voteRows.map((row) => [Number(row.optionIndex), parseInt(row.count, 10)]),
    );
    const counts = poll.options.map((_, i) => countByOption.get(i) ?? 0);
    const totalVotes = counts.reduce((a, b) => a + b, 0);

    return {
      id: poll.id,
      streamId: poll.streamId,
      question: poll.question,
      options: poll.options,
      counts,
      totalVotes,
      isActive: poll.isActive,
    };
  }

  async getStreamHealth(streamId: string, requesterId: string, role?: UserRole | null) {
    const stream = await this.streamingService.findById(streamId);
    if (stream.userId !== requesterId && role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }

    const reconnecting = !!(stream.muxIdleSince && stream.status === StreamStatus.LIVE);
    let muxStatus: string | null = null;
    if (stream.status === StreamStatus.LIVE) {
      muxStatus = stream.muxIdleSince ? 'idle' : 'active';
    } else if (stream.status === StreamStatus.IDLE) {
      muxStatus = 'idle';
    } else if (stream.status === StreamStatus.ENDED) {
      muxStatus = 'disabled';
    }

    const reconnectGraceSec = this.muxLiveSyncService.reconnectGraceSec();
    const reconnectDeadline = reconnecting
      ? new Date(stream.muxIdleSince!.getTime() + reconnectGraceSec * 1000).toISOString()
      : null;

    return {
      streamId,
      status: stream.status,
      muxStatus,
      reconnecting,
      reconnectDeadline,
      reconnectGraceSec,
      reconnectAttempts: await this.muxLiveSyncService.getReconnectAttempts(streamId),
      endReason: stream.endReason ?? null,
      livekitEgressId: stream.livekitEgressId,
      viewerCount: stream.viewerCount,
      startedAt: stream.startedAt,
      playbackId: stream.muxPlaybackId ?? muxPlaybackIdFromHlsUrl(stream.playbackUrl),
    };
  }

  async listClips(streamId: string) {
    const clips = await this.clipRepository.find({
      where: { streamId },
      order: { startOffsetMs: 'ASC' },
      take: 100,
    });
    return clips.map((c) => ({
      id: c.id,
      streamId: c.streamId,
      userId: c.userId,
      title: c.title,
      startOffsetMs: Number(c.startOffsetMs),
      endOffsetMs: Number(c.endOffsetMs),
      status: c.status,
      createdAt: c.createdAt,
    }));
  }

  async createClip(
    streamId: string,
    userId: string,
    dto: CreateStreamClipDto,
    role?: UserRole | null,
  ) {
    if (!(await this.canModerate(streamId, userId, role))) {
      throw new ForbiddenException();
    }

    const stream = await this.streamingService.findById(streamId);
    const defaultDuration =
      this.configService.get<number>('stream.defaultClipDurationMs') ?? 30_000;
    const startOffsetMs =
      dto.startOffsetMs ?? computeStreamOffsetMs(stream) ?? 0;
    const endOffsetMs = dto.endOffsetMs ?? startOffsetMs + defaultDuration;
    if (endOffsetMs <= startOffsetMs) {
      throw new BadRequestException('Clip end must be after start');
    }

    const clip = await this.clipRepository.save(
      this.clipRepository.create({
        streamId,
        userId,
        title: dto.title?.trim() || `Highlight at ${Math.floor(startOffsetMs / 1000)}s`,
        startOffsetMs,
        endOffsetMs,
        status: 'ready',
      }),
    );

    this.eventEmitter.emit('stream.clip.created', {
      streamId,
      clip: {
        id: clip.id,
        startOffsetMs: Number(clip.startOffsetMs),
        endOffsetMs: Number(clip.endOffsetMs),
        title: clip.title,
      },
    });

    return {
      id: clip.id,
      streamId: clip.streamId,
      title: clip.title,
      startOffsetMs: Number(clip.startOffsetMs),
      endOffsetMs: Number(clip.endOffsetMs),
      status: clip.status,
    };
  }

  async listCaptions(streamId: string) {
    const rows = await this.captionRepository.find({
      where: { streamId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return rows.map((c) => ({
      id: c.id,
      streamId: c.streamId,
      videoId: c.videoId,
      language: c.language,
      vttUrl: c.vttUrl,
      source: c.source,
    }));
  }

  async backfillMuxPlaybackIds(): Promise<number> {
    const streams = await this.streamRepository
      .createQueryBuilder('s')
      .where('s.mux_playback_id IS NULL')
      .andWhere('s.playback_url IS NOT NULL')
      .getMany();
    let updated = 0;
    for (const stream of streams) {
      if (stream.muxPlaybackId || !stream.playbackUrl) continue;
      const pb = muxPlaybackIdFromHlsUrl(stream.playbackUrl);
      if (pb) {
        await this.streamRepository.update(stream.id, { muxPlaybackId: pb });
        updated++;
      }
    }
    return updated;
  }

  private raiseHandKey(streamId: string): string {
    return `stream:raise-hand:${streamId}`;
  }

  async raiseHand(streamId: string, userId: string) {
    await this.streamingService.findById(streamId);
    const key = this.raiseHandKey(streamId);
    const raisedAt = Date.now().toString();
    await this.redis.hset(key, userId, raisedAt);
    await this.redis.expire(key, 3600);
    this.eventEmitter.emit('stream.raise-hand', {
      streamId,
      userId,
      raised: true,
      raisedAt: new Date(Number(raisedAt)).toISOString(),
    });
    return { raised: true };
  }

  async lowerHand(streamId: string, userId: string) {
    await this.redis.hdel(this.raiseHandKey(streamId), userId);
    this.eventEmitter.emit('stream.raise-hand', { streamId, userId, raised: false });
    return { raised: false };
  }

  async listRaisedHands(streamId: string) {
    const raw = await this.redis.hgetall(this.raiseHandKey(streamId));
    return Object.entries(raw).map(([uid, ts]) => ({
      userId: uid,
      raisedAt: new Date(Number(ts)),
    }));
  }

  // ── Audience Requests (P07-T027, P07-T031) ──────────────────────────────────

  async createAudienceRequest(
    streamId: string,
    userId: string,
    requestType: AudienceRequestType,
    message?: string,
  ): Promise<StreamAudienceRequest> {
    const stream = await this.streamRepository.findOne({ where: { id: streamId } });
    if (!stream) throw new NotFoundException('Stream not found');
    if (stream.status !== StreamStatus.LIVE) throw new BadRequestException('Stream is not live');
    if (stream.userId === userId) throw new BadRequestException('Creator cannot request own stream');

    const existing = await this.audienceRequestRepository.findOne({
      where: { streamId, userId },
    });
    if (existing && existing.status === AudienceRequestStatus.PENDING) {
      return existing;
    }
    if (existing) {
      existing.status = AudienceRequestStatus.PENDING;
      existing.requestType = requestType;
      existing.message = message ?? null;
      return this.audienceRequestRepository.save(existing);
    }

    const request = this.audienceRequestRepository.create({
      streamId,
      userId,
      requestType,
      message: message ?? null,
      status: AudienceRequestStatus.PENDING,
    });
    const saved = await this.audienceRequestRepository.save(request);

    this.eventEmitter.emit('stream.audience_request', {
      streamId,
      creatorId: stream.userId,
      requestId: saved.id,
      userId,
      requestType,
    });
    return saved;
  }

  async respondToAudienceRequest(
    streamId: string,
    requestId: string,
    creatorId: string,
    approve: boolean,
  ): Promise<StreamAudienceRequest> {
    const stream = await this.streamRepository.findOne({ where: { id: streamId } });
    if (!stream) throw new NotFoundException('Stream not found');
    if (stream.userId !== creatorId) throw new ForbiddenException();

    const request = await this.audienceRequestRepository.findOne({
      where: { id: requestId, streamId },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== AudienceRequestStatus.PENDING) {
      throw new BadRequestException('Request already processed');
    }

    request.status = approve
      ? AudienceRequestStatus.APPROVED
      : AudienceRequestStatus.REJECTED;
    return this.audienceRequestRepository.save(request);
  }

  async listAudienceRequests(
    streamId: string,
    creatorId: string,
    status?: AudienceRequestStatus,
  ): Promise<StreamAudienceRequest[]> {
    const stream = await this.streamRepository.findOne({ where: { id: streamId } });
    if (!stream) throw new NotFoundException('Stream not found');
    if (stream.userId !== creatorId) throw new ForbiddenException();

    return this.audienceRequestRepository.find({
      where: { streamId, ...(status ? { status } : {}) },
      order: { createdAt: 'ASC' },
    });
  }

  async withdrawAudienceRequest(streamId: string, userId: string): Promise<void> {
    const request = await this.audienceRequestRepository.findOne({
      where: { streamId, userId },
    });
    if (!request) return;
    if (request.status === AudienceRequestStatus.PENDING) {
      request.status = AudienceRequestStatus.WITHDRAWN;
      await this.audienceRequestRepository.save(request);
    }
  }
}
