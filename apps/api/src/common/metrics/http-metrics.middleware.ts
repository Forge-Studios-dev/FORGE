import type { Request, Response, NextFunction } from 'express';
import { isInfraProbePath } from '../http/infra-probe-path.util';
import { forgeMetricsEnabled, getForgeMetricsRegistry, recordHttpRequest } from './forge-metrics';

/** Records request count and latency when METRICS_ENABLED=true. */
export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!forgeMetricsEnabled() || isInfraProbePath(req.url)) {
    next();
    return;
  }
  getForgeMetricsRegistry();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedNs = Number(process.hrtime.bigint() - start);
    recordHttpRequest(req.method, res.statusCode, elapsedNs / 1e9);
  });
  next();
}
