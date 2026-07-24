import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository, IsNull, Not, LessThanOrEqual } from 'typeorm';
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

@Injectable()
export class MuxLiveSyncService {
  private readonly logger = new Logger(MuxLiveSyncService.name);
  private readonly mux: Mux;

  private static readonly MUX_SYNC_IDLE_LIMIT = 20;
  private static readonly IDLE_SYNC_LOCK_KEY = 'streams:mux:idle-sync:lock';
  private static readonly IDLE_SYNC_LOCK_TTL_SEC = 45;
  private static readonly MUX_SYNC_TTL_IDLE_SEC = 15;
  private static readonly MUX_SYNC_TTL_LIVE_SEC = 60;
  private static readonly LIVE_GRACE_SCAN_LIMIT = 50;
  /** @deprecated Use PLATFORM_DORMANT_KEY from platform-dormant.util */
  static readonly PLATFORM_DORMANT_KEY = PLATFORM_DORMANT_KEY;
  private static readonly PLATFORM_DORMANT_TTL_SEC = 1200;

  constructor(
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly streamViewerService: StreamViewerService,
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

  /** Periodic worker scan: idle go-live reconciliation + idle-grace finalization + Mux poll. */
  async runPeriodicScan(): Promise<{ synced: number; finalized: number }> {
    if (await this.isPlatformDormant()) {
      return { synced: 0, finalized: 0 };
    }

    const hasGraceWork = await this.hasStreamsPastIdleGrace();
    if (!hasGraceWork && !(await this.hasMuxSyncCandidates())) {
      await this.markPlatformDormant();
      return { synced: 0, finalized: 0 };
    }

    const finalized = hasGraceWork ? await this.finalizeStreamsPastIdleGrace() : 0;
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

    const idleCount = await this.streamRepository.count({
      where: {
        status: StreamStatus.IDLE,
        endedAt: IsNull(),
        muxLiveStreamId: Not(IsNull()),
      },
    });
    return idleCount > 0;
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
        } else if (Date.now() - idleSince.getTime() >= this.idleGraceMs()) {
          this.logger.warn(
            `Reconnection timeout expired for stream ${stream.id} — auto-terminating (connection lost)`,
          );
          await this.finalizeStreamEnded(stream, StreamEndReason.CONNECTION_LOST);
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

    for (const stream of candidates) {
      this.logger.warn(
        `Reconnection timeout expired for stream ${stream.id} — auto-terminating (connection lost)`,
      );
      await this.finalizeStreamEnded(stream, StreamEndReason.CONNECTION_LOST);
    }
    return candidates.length;
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
      where: {
        status: StreamStatus.IDLE,
        endedAt: IsNull(),
        muxLiveStreamId: Not(IsNull()),
      },
      order: { createdAt: 'DESC' },
      take: MuxLiveSyncService.MUX_SYNC_IDLE_LIMIT,
    });

    const toSync = idleCandidates.filter(
      (s) => s.muxLiveStreamId && s.muxLiveStreamId !== 'mock-stream-id',
    );

    await Promise.all(toSync.map((s) => this.syncStream(s)));
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
