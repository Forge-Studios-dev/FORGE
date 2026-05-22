import type { Request, Response, NextFunction } from 'express';
import { forgeMetricsEnabled, getForgeMetricsRegistry, recordHttpRequest } from './forge-metrics';

/** Records request count and latency when METRICS_ENABLED=true. */
export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!forgeMetricsEnabled()) {
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
