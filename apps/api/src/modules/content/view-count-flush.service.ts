import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { tryAcquireIntervalLeader } from '../../common/redis/redis-interval-leader.util';
import { Video } from './entities/video.entity';

const PENDING_VIEW_PREFIX = 'video:views:pending:';
/** Set of video IDs with pending deltas — avoids empty Redis SCAN every minute. */
export const PENDING_VIEW_IDS_KEY = 'video:views:pending:ids';
const FLUSH_INTERVAL_MS = 60_000;
const LEADER_LOCK_KEY = 'leader:view-count-flush';
const LEADER_LOCK_TTL_SEC = 55;
const FLUSH_CHUNK = 100;

@Injectable()
export class ViewCountFlushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ViewCountFlushService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.configService.get<boolean>('workerOnly')) return;
    this.timer = setInterval(() => {
      void this.flushPendingViewCounts().catch((err) => {
        this.logger.error(err instanceof Error ? err.message : String(err));
      });
    }, FLUSH_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async flushPendingViewCounts(): Promise<void> {
    const pendingCount = await this.redis.scard(PENDING_VIEW_IDS_KEY);
    if (pendingCount === 0) return;

    const isLeader = await tryAcquireIntervalLeader(
      this.redis,
      LEADER_LOCK_KEY,
      LEADER_LOCK_TTL_SEC,
      this.logger,
    );
    if (!isLeader) return;

    const updates: { videoId: string; delta: number }[] = [];
    for (;;) {
      const videoIds = await this.redis.spop(PENDING_VIEW_IDS_KEY, FLUSH_CHUNK);
      const ids = Array.isArray(videoIds) ? videoIds : videoIds ? [videoIds] : [];
      if (!ids.length) break;

      for (const videoId of ids) {
        const key = `${PENDING_VIEW_PREFIX}${videoId}`;
        const raw = await this.redis.get(key);
        if (!raw) continue;
        const delta = parseInt(raw, 10);
        if (delta > 0) updates.push({ videoId, delta });
        await this.redis.del(key);
      }
      if (ids.length < FLUSH_CHUNK) break;
    }

    if (updates.length === 0) return;

    for (let i = 0; i < updates.length; i += FLUSH_CHUNK) {
      const chunk = updates.slice(i, i + FLUSH_CHUNK);
      await Promise.all(
        chunk.map(({ videoId, delta }) =>
          this.videoRepository.increment({ id: videoId }, 'viewCount', delta),
        ),
      );
    }
    this.logger.debug(`Flushed pending view counts for ${updates.length} video(s)`);
  }
}
