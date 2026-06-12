import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { Stream, StreamStatus } from './entities/stream.entity';
import { tryAcquireIntervalLeader } from '../../common/redis/redis-interval-leader.util';
import { StreamAnalyticsService } from './stream-analytics.service';

/** Redis set of stream IDs currently LIVE — avoids polling Postgres when nothing is live. */
const LIVE_INDEX_KEY = 'streams:live:ids';
const LEADER_LOCK_KEY = 'leader:stream-viewer-flush';
const LEADER_LOCK_TTL_SEC = 25;
/** Reconcile Redis index from DB every ~10 minutes (20 × 30s flushes). */
const RECONCILE_EVERY_N_FLUSHES = 20;
/** Analytics snapshot INSERT + chat COUNT at most once per minute per stream. */
const SNAPSHOT_THROTTLE_SEC = 60;

@Injectable()
export class StreamViewerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StreamViewerService.name);
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushCount = 0;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    private readonly streamAnalyticsService: StreamAnalyticsService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    if (this.configService.get<boolean>('workerOnly')) {
      this.logger.log('Viewer count flush skipped on worker process (API handles socket viewers)');
      return;
    }
    void this.reconcileLiveIndexFromDb();
    this.flushTimer = setInterval(() => void this.flushAllLiveStreams(), 30_000);
  }

  onModuleDestroy() {
    if (this.flushTimer) clearInterval(this.flushTimer);
  }

  /** Call when a stream transitions to LIVE. */
  async trackStreamLive(streamId: string): Promise<void> {
    await this.redis.sadd(LIVE_INDEX_KEY, streamId);
  }

  /** Call when a stream ends — removes viewer set and live index entry. */
  async trackStreamEnded(streamId: string): Promise<void> {
    await this.redis.srem(LIVE_INDEX_KEY, streamId);
    await this.redis.del(this.viewerSetKey(streamId));
  }

  private viewerSetKey(streamId: string): string {
    return `stream:viewers:${streamId}`;
  }

  private uniqueViewerKey(streamId: string): string {
    return `stream:unique:viewers:${streamId}`;
  }

  async trackUniqueViewer(streamId: string, userId: string): Promise<void> {
    if (!userId) return;
    const key = this.uniqueViewerKey(streamId);
    await this.redis.pfadd(key, userId);
    await this.redis.expire(key, 86_400 * 7);
  }

  async getUniqueViewerCount(streamId: string): Promise<number> {
    const count = await this.redis.pfcount(this.uniqueViewerKey(streamId));
    return count || 0;
  }

  async finalizeUniqueViewers(streamId: string): Promise<number> {
    const count = await this.getUniqueViewerCount(streamId);
    await this.redis.del(this.uniqueViewerKey(streamId));
    return count;
  }

  async join(streamId: string, socketId: string, userId?: string | null): Promise<number> {
    const key = this.viewerSetKey(streamId);
    await this.redis.sadd(key, socketId);
    await this.redis.expire(key, 86_400);
    if (userId) await this.trackUniqueViewer(streamId, userId);
    return this.redis.scard(key);
  }

  async leave(streamId: string, socketId: string): Promise<number> {
    const key = this.viewerSetKey(streamId);
    await this.redis.srem(key, socketId);
    const count = await this.redis.scard(key);
    if (count === 0) await this.redis.del(key);
    return count;
  }

  async getCount(streamId: string): Promise<number> {
    return this.redis.scard(this.viewerSetKey(streamId));
  }

  async flushStream(streamId: string): Promise<number> {
    const count = await this.getCount(streamId);
    await this.streamRepository.update({ id: streamId }, { viewerCount: count });
    try {
      const throttleKey = `stream:snapshot:throttle:${streamId}`;
      const acquired = await this.redis.set(throttleKey, '1', 'EX', SNAPSHOT_THROTTLE_SEC, 'NX');
      if (acquired === 'OK') {
        await this.streamAnalyticsService.recordSnapshot(streamId, count);
      }
    } catch (err) {
      this.logger.warn(`Analytics snapshot failed: ${(err as Error).message}`);
    }
    return count;
  }

  private async reconcileLiveIndexFromDb(): Promise<void> {
    try {
      const live = await this.streamRepository.find({
        where: { status: StreamStatus.LIVE },
        select: ['id'],
      });
      if (!live.length) {
        await this.redis.del(LIVE_INDEX_KEY);
        return;
      }
      const pipe = this.redis.pipeline();
      pipe.del(LIVE_INDEX_KEY);
      for (const s of live) {
        pipe.sadd(LIVE_INDEX_KEY, s.id);
      }
      await pipe.exec();
    } catch (err) {
      this.logger.warn(`Live index reconcile failed: ${(err as Error).message}`);
    }
  }

  private async flushAllLiveStreams(): Promise<void> {
    try {
      const isLeader = await tryAcquireIntervalLeader(
        this.redis,
        LEADER_LOCK_KEY,
        LEADER_LOCK_TTL_SEC,
        this.logger,
      );
      if (!isLeader) return;

      this.flushCount += 1;
      if (this.flushCount % RECONCILE_EVERY_N_FLUSHES === 0) {
        await this.reconcileLiveIndexFromDb();
      }

      const ids = await this.redis.smembers(LIVE_INDEX_KEY);
      if (!ids.length) return;

      await Promise.all(ids.map((id) => this.flushStream(id)));
    } catch (err) {
      this.logger.warn(`Viewer count flush failed: ${(err as Error).message}`);
    }
  }

  async syncCountsForStreams(streamIds: string[]): Promise<void> {
    if (!streamIds.length) return;
    const unique = [...new Set(streamIds)];
    await Promise.all(unique.map((id) => this.flushStream(id)));
  }
}
