import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Video } from './entities/video.entity';

const PENDING_VIEW_PREFIX = 'video:views:pending:';
const FLUSH_INTERVAL_MS = 60_000;

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
    let cursor = '0';
    const updates: { videoId: string; delta: number }[] = [];

    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${PENDING_VIEW_PREFIX}*`,
        'COUNT',
        100,
      );
      cursor = next;
      for (const key of keys) {
        const videoId = key.slice(PENDING_VIEW_PREFIX.length);
        const raw = await this.redis.get(key);
        if (!raw) continue;
        const delta = parseInt(raw, 10);
        if (delta > 0) updates.push({ videoId, delta });
        await this.redis.del(key);
      }
    } while (cursor !== '0');

    if (updates.length === 0) return;

    await Promise.all(
      updates.map(({ videoId, delta }) =>
        this.videoRepository.increment({ id: videoId }, 'viewCount', delta),
      ),
    );
    this.logger.debug(`Flushed pending view counts for ${updates.length} video(s)`);
  }
}
