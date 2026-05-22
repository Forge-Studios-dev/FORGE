import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { Response } from 'express';
import { collectDefaultMetrics } from 'prom-client';
import { Public } from '../decorators/public.decorator';
import { forgeMetricsEnabled, getForgeMetricsRegistry } from './forge-metrics';

@Controller('metrics')
export class MetricsController {
  private defaultsRegistered = false;

  @Public()
  @Get()
  async metrics(@Res({ passthrough: true }) res: Response): Promise<string> {
    if (!forgeMetricsEnabled()) {
      throw new NotFoundException();
    }
    const register = getForgeMetricsRegistry();
    if (!this.defaultsRegistered) {
      collectDefaultMetrics({ register });
      this.defaultsRegistered = true;
    }
    res.setHeader('Content-Type', register.contentType);
    return register.metrics();
  }
}
