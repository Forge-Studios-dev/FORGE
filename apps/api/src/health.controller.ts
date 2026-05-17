import { Controller, Get, Req } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Request } from 'express';
import { Public } from './common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRedis()
    private readonly redis: Redis,
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

    return {
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      checks,
      correlationId: req.correlationId,
    };
  }
}
