/**
 * Paths that should not flood access logs.
 * Fly platform probes hit `/api/v1/health/live` (~30s); Prometheus scrapes `/metrics`.
 * `/health/ready` stays out of this set so intentional diagnostics remain visible.
 */
const INFRA_PROBE_PATHS = new Set(['/api/v1/health/live', '/metrics']);

/** Health/live and Prometheus scrapes — not normal app traffic. */
export function isInfraProbePath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?', 1)[0] ?? '';
  return INFRA_PROBE_PATHS.has(path);
}
