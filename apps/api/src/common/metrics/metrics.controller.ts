import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { Response } from 'express';
import { collectDefaultMetrics, Registry } from 'prom-client';
import { Public } from '../decorators/public.decorator';

@Controller('metrics')
export class MetricsController {
  private readonly register: Registry;

  constructor() {
    this.register = new Registry();
    collectDefaultMetrics({ register: this.register });
  }

  @Public()
  @Get()
  async metrics(@Res({ passthrough: true }) res: Response): Promise<string> {
    if (process.env.METRICS_ENABLED !== 'true') {
      throw new NotFoundException();
    }
    res.setHeader('Content-Type', this.register.contentType);
    return this.register.metrics();
  }
}
