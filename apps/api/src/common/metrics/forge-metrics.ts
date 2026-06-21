import { Counter, Histogram, Registry } from 'prom-client';

let registry: Registry | null = null;
let httpRequestsTotal: Counter<'method' | 'status'> | null = null;
let httpRequestDuration: Histogram<'method' | 'status'> | null = null;
let socketJoinDenials: Counter<'kind'> | null = null;
let accessSessionConflicts: Counter<'code'> | null = null;
let entitlementCacheHits: Counter<'result'> | null = null;

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
    socketJoinDenials = new Counter({
      name: 'forge_socket_join_denials_total',
      help: 'Socket join attempts denied (ACL, tier, rate limit)',
      labelNames: ['kind'] as const,
      registers: [registry],
    });
    accessSessionConflicts = new Counter({
      name: 'forge_access_session_conflicts_total',
      help: 'Premium access session conflicts (concurrent / missing session)',
      labelNames: ['code'] as const,
      registers: [registry],
    });
    entitlementCacheHits = new Counter({
      name: 'forge_entitlement_cache_lookups_total',
      help: 'Entitlement negative-cache lookups',
      labelNames: ['result'] as const,
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

export function recordSocketJoinDenial(kind: 'community' | 'channel' | 'room'): void {
  if (!forgeMetricsEnabled() || !socketJoinDenials) return;
  socketJoinDenials.inc({ kind });
}

export function recordAccessSessionConflict(code: string): void {
  if (!forgeMetricsEnabled() || !accessSessionConflicts) return;
  accessSessionConflicts.inc({ code });
}

export function recordEntitlementCacheHit(hit: boolean): void {
  if (!forgeMetricsEnabled() || !entitlementCacheHits) return;
  entitlementCacheHits.inc({ result: hit ? 'hit' : 'miss' });
}
