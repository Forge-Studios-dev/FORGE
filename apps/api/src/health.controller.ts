import { Controller, Get, Optional, Req } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from './common/decorators/public.decorator';
import { VIDEO_PROCESSING_QUEUE } from './modules/content/video-processing.constants';
import { MUX_VOD_INGEST_QUEUE } from './modules/content/mux-vod.constants';

const HEALTH_CHECK_MS = 2_500;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Health endpoints — manual / deploy-diagnostic only (no Fly or app polling).
 * `/health/live` is cheap liveness (no DB). `/health/ready` checks DB + Redis.
 */
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly configService: ConfigService,
    @InjectQueue(VIDEO_PROCESSING_QUEUE)
    private readonly videoQueue: Queue,
    @Optional()
    @InjectQueue(MUX_VOD_INGEST_QUEUE)
    private readonly muxVodQueue?: Queue,
  ) {}

  @Public()
  @Get()
  async getHealth(@Req() req: Request) {
    // Backwards-compatible: treat /health as readiness (deep checks).
    return this.getReady(req);
  }

  /**
   * Liveness: cheap and dependency-free. Call manually when needed.
   */
  @Public()
  @SkipThrottle()
  @Get('live')
  getLive(@Req() req: Request) {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
    };
  }

  /**
   * Readiness: dependency checks (DB/Redis/Queue). Manual / deploy diagnostics only.
   */
  @Public()
  @Get('ready')
  async getReady(@Req() req: Request) {
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

    const transcodeProvider =
      (this.configService.get<string>('video.transcodeProvider') || 'mux').toLowerCase();

    const scanKind = (this.configService.get<string>('contentScan.provider') || 'none').toLowerCase();
    const scanUrl = (this.configService.get<string>('contentScan.webhookUrl') || '').trim();
    if (scanKind === 'webhook' && scanUrl) {
      checks.contentScan = 'webhook';
    } else if (scanKind === 'webhook') {
      checks.contentScan = 'misconfigured';
      degraded = true;
    } else {
      // Default noop — expected until a vendor webhook is configured (legal/ops).
      checks.contentScan = 'noop';
    }

    if (transcodeProvider === 'mux' && this.muxVodQueue) {
      try {
        const counts = await withTimeout(
          this.muxVodQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
          HEALTH_CHECK_MS,
          'muxVodQueue',
        );
        checks.muxVodQueue = JSON.stringify(counts);
      } catch {
        checks.muxVodQueue = 'unavailable';
      }
    } else {
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
    }

    return {
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      checks,
      correlationId: req.correlationId,
    };
  }
}
