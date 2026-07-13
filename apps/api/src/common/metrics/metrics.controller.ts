import {
  Controller,
  Get,
  NotFoundException,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { collectDefaultMetrics } from 'prom-client';
import { Public } from '../decorators/public.decorator';
import { forgeMetricsEnabled, getForgeMetricsRegistry } from './forge-metrics';
import { BullmqMetricsService } from './bullmq-metrics.service';

function metricsScrapeToken(): string | undefined {
  const token = process.env.METRICS_SCRAPE_TOKEN?.trim();
  return token || undefined;
}

function assertMetricsScrapeAuthorized(req: Request): void {
  const expected = metricsScrapeToken();
  if (!expected) {
    // Fail closed in production: an unset token must never mean "open scrape".
    if (process.env.NODE_ENV === 'production') throw new UnauthorizedException();
    return;
  }
  const auth = req.headers.authorization?.trim();
  // Grafana Cloud Bearer field: paste token only; client sends `Bearer <token>`.
  // Also accept raw token for scrapers that set Authorization without the prefix.
  if (auth === expected || auth === `Bearer ${expected}`) return;
  throw new UnauthorizedException();
}

@Controller('metrics')
export class MetricsController {
  private defaultsRegistered = false;

  constructor(private readonly bullmqMetrics: BullmqMetricsService) {}

  @Public()
  @Get()
  async metrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!forgeMetricsEnabled()) {
      throw new NotFoundException();
    }
    assertMetricsScrapeAuthorized(req);
    const register = getForgeMetricsRegistry();
    if (!this.defaultsRegistered) {
      collectDefaultMetrics({ register });
      this.defaultsRegistered = true;
    }
    await this.bullmqMetrics.refresh();
    const body = await register.metrics();
    res.setHeader('Content-Type', register.contentType);
    res.send(body);
  }
}
