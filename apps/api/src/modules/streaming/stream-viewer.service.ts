import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { Stream, StreamStatus } from './entities/stream.entity';

@Injectable()
export class StreamViewerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StreamViewerService.name);
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
  ) {}

  onModuleInit() {
    this.flushTimer = setInterval(() => void this.flushAllLiveStreams(), 30_000);
  }

  onModuleDestroy() {
    if (this.flushTimer) clearInterval(this.flushTimer);
  }

  private viewerSetKey(streamId: string): string {
    return `stream:viewers:${streamId}`;
  }

  async join(streamId: string, socketId: string): Promise<number> {
    const key = this.viewerSetKey(streamId);
    await this.redis.sadd(key, socketId);
    await this.redis.expire(key, 86_400);
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
    return count;
  }

  private async flushAllLiveStreams(): Promise<void> {
    try {
      const live = await this.streamRepository.find({
        where: { status: StreamStatus.LIVE },
        select: ['id'],
      });
      if (!live.length) return;
      await Promise.all(live.map((s) => this.flushStream(s.id)));
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
