import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { Repository, IsNull, Not, LessThanOrEqual, Between, MoreThanOrEqual } from 'typeorm';
import Mux from '@mux/mux-node';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Stream, StreamEndReason, StreamStatus } from './entities/stream.entity';
import { StreamViewerService } from './stream-viewer.service';
import {
  muxPlaybackIdFromHlsUrl,
  muxThumbnailUrl,
} from '../../common/media/mux-playback.util';
import {
  PLATFORM_DORMANT_KEY,
  isPlatformDormant as readPlatformDormant,
} from '../../common/streaming/platform-dormant.util';
import { streamDetailCacheKey } from '../../common/streaming/stream-detail-cache.util';
import { safeRedisDel } from '../../common/redis/redis-safe.util';
import { mapPool } from '../../common/utils/map-pool.util';
import {
  STREAM_MUX_SYNC_QUEUE,
  StreamMuxSyncJob,
} from '../workers/stream-mux-sync/stream-mux-sync.constants';

@Injectable()
export class MuxLiveSyncService {
  private readonly logger = new Logger(MuxLiveSyncService.name);
  private readonly mux: Mux;

  private static readonly MUX_SYNC_IDLE_LIMIT = 20;
  private static readonly MUX_SYNC_PARALLELISM = 5;
  /** Only backup-poll IDLE rooms scheduled in this window (or recently created unscheduled). */
  private static readonly IDLE_POLL_LOOKBACK_MS = 30 * 60_000;
  private static readonly IDLE_POLL_LOOKAHEAD_MS = 2 * 60 * 60_000;
  private static readonly IDLE_UNSCHEDULED_MAX_AGE_MS = 2 * 60 * 60_000;
  private static readonly IDLE_SYNC_LOCK_KEY = 'streams:mux:idle-sync:lock';
  private static readonly IDLE_SYNC_LOCK_TTL_SEC = 45;
  private static readonly MUX_SYNC_TTL_IDLE_SEC = 15;
  private static readonly MUX_SYNC_TTL_LIVE_SEC = 60;
  private static readonly LIVE_GRACE_SCAN_LIMIT = 50;
  private static readonly FINALIZE_LOCK_TTL_SEC = 60;
  /** @deprecated Use PLATFORM_DORMANT_KEY from platform-dormant.util */
  static readonly PLATFORM_DORMANT_KEY = PLATFORM_DORMANT_KEY;
  /**
   * Dormant Redis TTL = 2× default dormant job interval (15m → 30m) so skip
   * ticks can refresh the key before expiry without opening Postgres.
   */
  static readonly PLATFORM_DORMANT_TTL_SEC = Math.max(
    1800,
    Math.ceil((Number(process.env.MUX_SYNC_INTERVAL_DORMANT_MS ?? 900_000) / 1000) * 2),
  );

  constructor(
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly streamViewerService: StreamViewerService,
    @InjectQueue(STREAM_MUX_SYNC_QUEUE)
    private readonly muxSyncQueue: Queue<StreamMuxSyncJob>,
  ) {
    this.mux = new Mux({
      tokenId: configService.get<string>('mux.tokenId') || 'placeholder',
      tokenSecret: configService.get<string>('mux.tokenSecret') || 'placeholder',
    });
  }

  async syncStreamById(streamId: string): Promise<void> {
    await this.clearPlatformDormant();
    const stream = await this.streamRepository.findOne({ where: { id: streamId } });
    if (!stream) return;
    await this.syncStream(stream);
  }

  /** Clears deep-idle gate so the next periodic scan probes Postgres (webhooks, stream create). */
  async clearPlatformDormant(): Promise<void> {
    try {
      await this.redis.del(PLATFORM_DORMANT_KEY);
    } catch {
      // non-fatal
    }
  }

  async isPlatformDormant(): Promise<boolean> {
    return readPlatformDormant(this.redis);
  }

  private async markPlatformDormant(): Promise<void> {
    try {
      await this.redis.setex(PLATFORM_DORMANT_KEY, MuxLiveSyncService.PLATFORM_DORMANT_TTL_SEC, '1');
    } catch (err) {
      this.logger.warn(`Platform dormant mark failed: ${(err as Error).message}`);
    }
  }

  /** Periodic backup scan: idle-grace sweep + rare Mux REST poll for missed webhooks. */
  async runPeriodicScan(): Promise<{ synced: number; finalized: number }> {
    if (await this.isPlatformDormant()) {
      // Refresh TTL so the key does not expire between dormant-mode job ticks.
      await this.markPlatformDormant();
      return { synced: 0, finalized: 0 };
    }

    const hasGraceWork = await this.hasStreamsPastIdleGrace();
    if (!hasGraceWork && !(await this.hasMuxSyncCandidates())) {
      await this.markPlatformDormant();
      return { synced: 0, finalized: 0 };
    }

    const finalized = hasGraceWork ? await this.finalizeStreamsPastIdleGrace() : 0;
    // Mux REST is backup only — primary path is webhooks + delayed grace jobs.
    const synced = await this.syncIdleCandidateStreams();
    return { synced, finalized };
  }

  /** True when any stream is currently LIVE (Redis index or DB). Used for adaptive sync interval. */
  async hasActiveLiveStreams(): Promise<boolean> {
    try {
      const liveCount = await this.redis.scard('streams:live:ids');
      if (liveCount > 0) return true;
    } catch {
      // fall through
    }
    const dbLive = await this.streamRepository.count({
      where: { status: StreamStatus.LIVE },
    });
    return dbLive > 0;
  }

  /** True when Redis live index or DB has IDLE streams eligible for Mux poll. */
  private async hasMuxSyncCandidates(): Promise<boolean> {
    try {
      const liveCount = await this.redis.scard('streams:live:ids');
      if (liveCount > 0) return true;
    } catch {
      // fall through to DB probe
    }

    if (!this.muxConfigured()) return false;

    const idleCount = await this.countIdleMuxPollCandidates();
    return idleCount > 0;
  }

  /**
   * IDLE rooms worth polling Mux for (webhook miss / go-live detection).
   * Abandoned scheduled rooms and stale unscheduled drafts must NOT block platform dormancy.
   */
  private idleMuxPollWhere() {
    const now = Date.now();
    const scheduledFrom = new Date(now - MuxLiveSyncService.IDLE_POLL_LOOKBACK_MS);
    const scheduledTo = new Date(now + MuxLiveSyncService.IDLE_POLL_LOOKAHEAD_MS);
    const createdAfter = new Date(now - MuxLiveSyncService.IDLE_UNSCHEDULED_MAX_AGE_MS);
    const base = {
      status: StreamStatus.IDLE,
      endedAt: IsNull(),
      muxLiveStreamId: Not(IsNull()),
    } as const;
    return [
      { ...base, scheduledAt: Between(scheduledFrom, scheduledTo) },
      { ...base, scheduledAt: IsNull(), createdAt: MoreThanOrEqual(createdAfter) },
    ];
  }

  private async countIdleMuxPollCandidates(): Promise<number> {
    return this.streamRepository.count({ where: this.idleMuxPollWhere() });
  }

  private async hasStreamsPastIdleGrace(): Promise<boolean> {
    const cutoff = new Date(Date.now() - this.idleGraceMs());
    const count = await this.streamRepository.count({
      where: {
        status: StreamStatus.LIVE,
        muxIdleSince: LessThanOrEqual(cutoff),
      },
    });
    return count > 0;
  }

  async handleWebhookActive(muxLiveStreamId: string): Promise<void> {
    await this.clearPlatformDormant();
    const stream = await this.streamRepository.findOne({ where: { muxLiveStreamId } });
    // A late/out-of-order "active" webhook can arrive after the reconnect grace
    // period already auto-terminated this stream — never resurrect an ENDED row.
    if (!stream || stream.status === StreamStatus.ENDED) return;
    const isFirstGoLive = stream && !stream.startedAt;
    const wasReconnecting = !!stream?.muxIdleSince;
    const thumbnailPatch =
      stream && !stream.thumbnailUrl && stream.playbackUrl
        ? (() => {
            const pb = muxPlaybackIdFromHlsUrl(stream.playbackUrl);
            return pb ? muxThumbnailUrl(pb) : undefined;
          })()
        : undefined;

    await this.streamRepository.update(
      { muxLiveStreamId },
      {
        status: StreamStatus.LIVE,
        startedAt: stream?.startedAt ?? new Date(),
        muxIdleSince: null,
        ...(thumbnailPatch ? { thumbnailUrl: thumbnailPatch } : {}),
      },
    );

    const updated = stream ?? (await this.streamRepository.findOne({ where: { muxLiveStreamId } }));
    if (!updated) return;

    await this.cancelGraceFinalize(updated.id);
    await this.streamViewerService.trackStreamLive(updated.id);
    await this.redis.del(this.muxSyncCacheKey(updated.id));
    void this.bustStreamDetailCache(updated.id);

    if (isFirstGoLive) {
      await this.resetReconnectAttempts(updated.id);
      this.eventEmitter.emit('stream.started', {
        streamId: updated.id,
        userId: updated.userId,
        title: updated.title,
        visibility: updated.visibility,
        requiredTierId: updated.requiredTierId,
        communityId: updated.communityId ?? null,
      });
    } else if (wasReconnecting) {
      this.logger.log(`Reconnection successful — host resumed ingest for stream ${updated.id}`);
      this.eventEmitter.emit('stream.reconnected', {
        streamId: updated.id,
        userId: updated.userId,
      });
    }
  }

  async handleWebhookIdle(muxLiveStreamId: string): Promise<void> {
    await this.clearPlatformDormant();
    const stream = await this.streamRepository.findOne({ where: { muxLiveStreamId } });
    if (!stream || stream.status !== StreamStatus.LIVE) return;

    const wasAlreadyIdle = !!stream.muxIdleSince;
    const idleSince = stream.muxIdleSince ?? new Date();
    await this.streamRepository.update({ muxLiveStreamId }, { muxIdleSince: idleSince });
    void this.bustStreamDetailCache(stream.id);

    if (!wasAlreadyIdle) {
      await this.emitReconnecting(stream, idleSince);
      await this.scheduleGraceFinalize(stream.id);
    }
  }

  /** First transition into idle — starts the reconnect grace period and notifies viewers. */
  private async emitReconnecting(stream: Stream, idleSince: Date): Promise<void> {
    const timeoutSec = this.idleGraceMs() / 1000;
    const attempt = await this.incrementReconnectAttempts(stream.id);
    this.logger.warn(
      `Host disconnected for stream ${stream.id} — reconnection started (attempt ${attempt}, window ${timeoutSec}s)`,
    );
    if (attempt === this.maxReconnectAttempts() + 1) {
      this.logger.warn(
        `Stream ${stream.id} has exceeded ${this.maxReconnectAttempts()} reconnect attempts — possible rapid connect/disconnect loop`,
      );
    }
    this.eventEmitter.emit('stream.reconnecting', {
      streamId: stream.id,
      userId: stream.userId,
      since: idleSince.toISOString(),
      timeoutSec,
      attempt,
    });
  }

  private reconnectAttemptsKey(streamId: string): string {
    return `stream:reconnect:attempts:${streamId}`;
  }

  /** Reconnect (idle→active) cycle count for the current stream lifetime — for health/observability. */
  async getReconnectAttempts(streamId: string): Promise<number> {
    try {
      const raw = await this.redis.get(this.reconnectAttemptsKey(streamId));
      return raw ? parseInt(raw, 10) : 0;
    } catch {
      return 0;
    }
  }

  /** Reconnect grace-period config (seconds) — surfaced to clients so they can render a countdown. */
  reconnectGraceSec(): number {
    return this.idleGraceMs() / 1000;
  }

  private async incrementReconnectAttempts(streamId: string): Promise<number> {
    try {
      const key = this.reconnectAttemptsKey(streamId);
      const count = await this.redis.incr(key);
      await this.redis.expire(key, 86_400);
      return count;
    } catch (err) {
      this.logger.warn(`Reconnect attempt counter failed for ${streamId}: ${(err as Error).message}`);
      return 1;
    }
  }

  private async resetReconnectAttempts(streamId: string): Promise<void> {
    try {
      await this.redis.del(this.reconnectAttemptsKey(streamId));
    } catch {
      // non-fatal
    }
  }

  private maxReconnectAttempts(): number {
    return this.configService.get<number>('mux.maxReconnectAttempts') ?? 20;
  }

  async syncStream(stream: Stream): Promise<Stream> {
    if (
      stream.status === StreamStatus.ENDED ||
      !stream.muxLiveStreamId ||
      stream.muxLiveStreamId === 'mock-stream-id' ||
      !this.muxConfigured()
    ) {
      return stream;
    }

    const ttlSec =
      stream.status === StreamStatus.IDLE
        ? MuxLiveSyncService.MUX_SYNC_TTL_IDLE_SEC
        : MuxLiveSyncService.MUX_SYNC_TTL_LIVE_SEC;
    const cacheKey = this.muxSyncCacheKey(stream.id);
    const recentlySynced = await this.redis.get(cacheKey);
    if (recentlySynced) return stream;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const muxStream = (await this.mux.video.liveStreams.retrieve(stream.muxLiveStreamId)) as any;
      const muxStatus = muxStream.status as string | undefined;

      if (muxStatus === 'active') {
        await this.applyActiveState(stream);
      } else if (muxStatus === 'idle' && stream.status === StreamStatus.LIVE) {
        const idleSince = stream.muxIdleSince ?? new Date();
        if (!stream.muxIdleSince) {
          await this.streamRepository.update(stream.id, { muxIdleSince: idleSince });
          stream.muxIdleSince = idleSince;
          void this.bustStreamDetailCache(stream.id);
          await this.emitReconnecting(stream, idleSince);
          await this.scheduleGraceFinalize(stream.id);
        } else if (Date.now() - idleSince.getTime() >= this.idleGraceMs()) {
          const acquired = await this.redis.set(
            this.finalizeLockKey(stream.id),
            '1',
            'EX',
            MuxLiveSyncService.FINALIZE_LOCK_TTL_SEC,
            'NX',
          );
          if (acquired === 'OK') {
            this.logger.warn(
              `Reconnection timeout expired for stream ${stream.id} — auto-terminating (connection lost)`,
            );
            await this.finalizeStreamEnded(stream, StreamEndReason.CONNECTION_LOST);
          }
        }
      }
    } catch (err) {
      this.logger.warn(
        `Mux live stream sync failed for ${stream.id}: ${err instanceof Error ? err.message : err}`,
      );
      return stream;
    }

    await this.redis.setex(cacheKey, ttlSec, '1');
    return stream;
  }

  /**
   * Auto-terminate path: reconnect grace period expired with no host reconnect.
   * `endReason` defaults to CONNECTION_LOST since every current caller is a
   * timeout finalize (poll-based or periodic-scan sweep) — see finalizeStreamsPastIdleGrace.
   */
  async finalizeStreamEnded(
    stream: Stream,
    endReason: StreamEndReason = StreamEndReason.CONNECTION_LOST,
  ): Promise<void> {
    if (stream.status === StreamStatus.ENDED) return;
    await this.cancelGraceFinalize(stream.id);
    const uniqueViewerCount = await this.streamViewerService.finalizeUniqueViewers(stream.id);
    await this.streamRepository.update(stream.id, {
      status: StreamStatus.ENDED,
      endedAt: new Date(),
      endReason,
      muxIdleSince: null,
      uniqueViewerCount,
    });
    await this.streamViewerService.trackStreamEnded(stream.id);
    await this.resetReconnectAttempts(stream.id);
    void this.bustStreamDetailCache(stream.id);
    this.logger.log(`Live auto-ended for stream ${stream.id} (reason=${endReason}) — cleanup completed`);
    this.eventEmitter.emit('stream.ended', {
      streamId: stream.id,
      userId: stream.userId,
      title: stream.title,
      communityId: stream.communityId ?? null,
      endReason,
    });
  }

  /**
   * Event-driven reconnect timeout: fired by delayed Bull job after webhook idle.
   * No Mux REST call — only DB state + Socket.IO events via finalizeStreamEnded.
   */
  async finalizeIfGraceExpired(streamId: string): Promise<void> {
    const stream = await this.streamRepository.findOne({ where: { id: streamId } });
    if (!stream || stream.status !== StreamStatus.LIVE || !stream.muxIdleSince) return;
    if (Date.now() - stream.muxIdleSince.getTime() < this.idleGraceMs()) return;

    const acquired = await this.redis.set(
      this.finalizeLockKey(stream.id),
      '1',
      'EX',
      MuxLiveSyncService.FINALIZE_LOCK_TTL_SEC,
      'NX',
    );
    if (acquired !== 'OK') return;

    this.logger.warn(
      `Reconnection timeout expired for stream ${stream.id} — auto-terminating (connection lost, delayed job)`,
    );
    await this.finalizeStreamEnded(stream, StreamEndReason.CONNECTION_LOST);
  }

  private graceFinalizeJobId(streamId: string): string {
    return `mux-grace-finalize:${streamId}`;
  }

  /**
   * Retries disabling a Mux live stream after endStream's inline attempt
   * failed — otherwise a transient Mux/network error leaves the RTMP stream
   * key live indefinitely even though FORGE's own row shows ENDED.
   */
  async scheduleDisableRetry(muxLiveStreamId: string): Promise<void> {
    try {
      await this.muxSyncQueue.add(
        'disable-live-stream',
        { disableMuxLiveStreamId: muxLiveStreamId },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch (err) {
      this.logger.warn(`Failed to enqueue Mux disable retry: ${(err as Error).message}`);
    }
  }

  async retryDisableLiveStream(muxLiveStreamId: string): Promise<void> {
    await this.mux.video.liveStreams.disable(muxLiveStreamId);
  }

  /** Schedule exact-time finalize after webhook idle — replaces tight polling. */
  async scheduleGraceFinalize(streamId: string): Promise<void> {
    const delay = this.idleGraceMs();
    const jobId = this.graceFinalizeJobId(streamId);
    try {
      const existing = await this.muxSyncQueue.getJob(jobId);
      if (existing) await existing.remove();
      await this.muxSyncQueue.add(
        'finalize-grace',
        { finalizeStreamId: streamId },
        {
          jobId,
          delay,
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch (err) {
      this.logger.warn(
        `Grace finalize schedule failed for ${streamId}: ${(err as Error).message}`,
      );
    }
  }

  async cancelGraceFinalize(streamId: string): Promise<void> {
    try {
      const job = await this.muxSyncQueue.getJob(this.graceFinalizeJobId(streamId));
      if (job) await job.remove();
    } catch {
      // non-fatal
    }
  }

  private async applyActiveState(stream: Stream): Promise<void> {
    const isFirstGoLive = !stream.startedAt;
    const wasReconnecting = !!stream.muxIdleSince;
    const thumbnailPatch =
      !stream.thumbnailUrl && stream.playbackUrl
        ? (() => {
            const pb = muxPlaybackIdFromHlsUrl(stream.playbackUrl);
            return pb ? muxThumbnailUrl(pb) : undefined;
          })()
        : undefined;

    await this.streamRepository.update(stream.id, {
      status: StreamStatus.LIVE,
      startedAt: stream.startedAt ?? new Date(),
      muxIdleSince: null,
      ...(thumbnailPatch ? { thumbnailUrl: thumbnailPatch } : {}),
    });

    await this.cancelGraceFinalize(stream.id);
    await this.streamViewerService.trackStreamLive(stream.id);
    void this.bustStreamDetailCache(stream.id);

    if (isFirstGoLive) {
      await this.resetReconnectAttempts(stream.id);
      this.eventEmitter.emit('stream.started', {
        streamId: stream.id,
        userId: stream.userId,
        title: stream.title,
        visibility: stream.visibility,
        requiredTierId: stream.requiredTierId,
        communityId: stream.communityId ?? null,
      });
    } else if (wasReconnecting) {
      this.logger.log(`Reconnection successful — host resumed ingest for stream ${stream.id}`);
      this.eventEmitter.emit('stream.reconnected', {
        streamId: stream.id,
        userId: stream.userId,
      });
    }
  }

  private async finalizeStreamsPastIdleGrace(): Promise<number> {
    const cutoff = new Date(Date.now() - this.idleGraceMs());
    const candidates = await this.streamRepository.find({
      where: {
        status: StreamStatus.LIVE,
        muxIdleSince: LessThanOrEqual(cutoff),
      },
      take: MuxLiveSyncService.LIVE_GRACE_SCAN_LIMIT,
    });

    let finalized = 0;
    for (const stream of candidates) {
      // Per-stream (not batch-wide) lock: another replica's periodic scan can
      // select the same grace-expired row concurrently — without this, both
      // would double-finalize (duplicate stream.ended emit, and the second
      // finalizeUniqueViewers call would overwrite the correct count with 0
      // since the Redis HLL key is already deleted by the first).
      const acquired = await this.redis.set(
        this.finalizeLockKey(stream.id),
        '1',
        'EX',
        MuxLiveSyncService.FINALIZE_LOCK_TTL_SEC,
        'NX',
      );
      if (acquired !== 'OK') continue;

      this.logger.warn(
        `Reconnection timeout expired for stream ${stream.id} — auto-terminating (connection lost)`,
      );
      await this.finalizeStreamEnded(stream, StreamEndReason.CONNECTION_LOST);
      finalized += 1;
    }
    return finalized;
  }

  private finalizeLockKey(streamId: string): string {
    return `stream:finalize:lock:${streamId}`;
  }

  private async syncIdleCandidateStreams(): Promise<number> {
    const acquired = await this.redis.set(
      MuxLiveSyncService.IDLE_SYNC_LOCK_KEY,
      '1',
      'EX',
      MuxLiveSyncService.IDLE_SYNC_LOCK_TTL_SEC,
      'NX',
    );
    if (acquired !== 'OK') return 0;

    const idleCandidates = await this.streamRepository.find({
      where: this.idleMuxPollWhere(),
      order: { createdAt: 'DESC' },
      take: MuxLiveSyncService.MUX_SYNC_IDLE_LIMIT,
    });

    const toSync = idleCandidates.filter(
      (s) => s.muxLiveStreamId && s.muxLiveStreamId !== 'mock-stream-id',
    );

    await mapPool(toSync, MuxLiveSyncService.MUX_SYNC_PARALLELISM, async (s) => {
      await this.syncStream(s);
    });
    return toSync.length;
  }

  private muxSyncCacheKey(streamId: string): string {
    return `stream:mux:sync:${streamId}`;
  }

  private async bustStreamDetailCache(streamId: string): Promise<void> {
    await safeRedisDel(this.redis, streamDetailCacheKey(streamId), this.logger);
  }

  private muxConfigured(): boolean {
    const muxTokenId = this.configService.get<string>('mux.tokenId');
    const muxTokenSecret = this.configService.get<string>('mux.tokenSecret');
    return !!(
      muxTokenId &&
      muxTokenSecret &&
      muxTokenId !== 'placeholder' &&
      muxTokenSecret !== 'placeholder'
    );
  }

  private idleGraceMs(): number {
    const sec = this.configService.get<number>('mux.idleGraceSec') ?? 60;
    return sec * 1000;
  }
}
