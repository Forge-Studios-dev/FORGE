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

function metricsScrapeToken(): string | undefined {
  const token = process.env.METRICS_SCRAPE_TOKEN?.trim();
  return token || undefined;
}

function assertMetricsScrapeAuthorized(req: Request): void {
  const expected = metricsScrapeToken();
  if (!expected) return;
  const auth = req.headers.authorization?.trim();
  if (auth === `Bearer ${expected}`) return;
  throw new UnauthorizedException();
}

@Controller('metrics')
export class MetricsController {
  private defaultsRegistered = false;

  @Public()
  @Get()
  async metrics(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    if (!forgeMetricsEnabled()) {
      throw new NotFoundException();
    }
    assertMetricsScrapeAuthorized(req);
    const register = getForgeMetricsRegistry();
    if (!this.defaultsRegistered) {
      collectDefaultMetrics({ register });
      this.defaultsRegistered = true;
    }
    res.setHeader('Content-Type', register.contentType);
    return register.metrics();
  }
}
