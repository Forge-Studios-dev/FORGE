import { Controller, Get, Req } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Request } from 'express';
import { Public } from './common/decorators/public.decorator';
import { VIDEO_PROCESSING_QUEUE } from './modules/content/videos.service';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRedis()
    private readonly redis: Redis,
    @InjectQueue(VIDEO_PROCESSING_QUEUE)
    private readonly videoQueue: Queue,
  ) {}

  @Public()
  @Get()
  async getHealth(@Req() req: Request) {
    const checks: Record<string, string> = { api: 'ok' };
    let degraded = false;

    try {
      await this.dataSource.query('SELECT 1');
      checks.database = 'ok';
    } catch {
      checks.database = 'down';
      degraded = true;
    }

    try {
      const pong = await this.redis.ping();
      checks.redis = pong === 'PONG' ? 'ok' : 'degraded';
      if (checks.redis !== 'ok') degraded = true;
    } catch {
      checks.redis = 'down';
      degraded = true;
    }

    try {
      const counts = await this.videoQueue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
      );
      checks.videoQueue = JSON.stringify(counts);
    } catch {
      checks.videoQueue = 'unavailable';
    }

    return {
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      checks,
      correlationId: req.correlationId,
    };
  }
}
