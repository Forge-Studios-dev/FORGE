/**
 * High-frequency infra paths only (Fly Consul liveness + Prometheus).
 * Readiness (/health, /health/ready) stays in logs/metrics so abuse is visible.
 */
const INFRA_PROBE_PATHS = new Set(['/api/v1/health/live', '/metrics']);

/** Fly Consul liveness probes and Prometheus scrapes — not app traffic. */
export function isInfraProbePath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?', 1)[0] ?? '';
  return INFRA_PROBE_PATHS.has(path);
}
