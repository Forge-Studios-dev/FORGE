import { Counter, Histogram, Registry } from 'prom-client';

let registry: Registry | null = null;
let httpRequestsTotal: Counter<'method' | 'status'> | null = null;
let httpRequestDuration: Histogram<'method' | 'status'> | null = null;

export function forgeMetricsEnabled(): boolean {
  return process.env.METRICS_ENABLED === 'true';
}

export function getForgeMetricsRegistry(): Registry {
  if (!registry) {
    registry = new Registry();
    httpRequestsTotal = new Counter({
      name: 'forge_http_requests_total',
      help: 'Total HTTP requests handled by the API',
      labelNames: ['method', 'status'] as const,
      registers: [registry],
    });
    httpRequestDuration = new Histogram({
      name: 'forge_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'status'] as const,
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [registry],
    });
  }
  return registry;
}

export function recordHttpRequest(method: string, status: number, durationSec: number): void {
  if (!forgeMetricsEnabled() || !httpRequestsTotal || !httpRequestDuration) return;
  const labels = { method, status: String(status) };
  httpRequestsTotal.inc(labels);
  httpRequestDuration.observe(labels, durationSec);
}
