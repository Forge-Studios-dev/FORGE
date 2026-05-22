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

const HEALTH_CHECK_MS = 2_500;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

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
      await withTimeout(this.dataSource.query('SELECT 1'), HEALTH_CHECK_MS, 'database');
      checks.database = 'ok';
    } catch {
      checks.database = 'down';
      degraded = true;
    }

    try {
      const pong = await withTimeout(this.redis.ping(), HEALTH_CHECK_MS, 'redis');
      checks.redis = pong === 'PONG' ? 'ok' : 'degraded';
      if (checks.redis !== 'ok') degraded = true;
    } catch {
      checks.redis = 'down';
      degraded = true;
    }

    try {
      const counts = await withTimeout(
        this.videoQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
        HEALTH_CHECK_MS,
        'videoQueue',
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
