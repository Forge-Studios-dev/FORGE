/** Exact paths for Fly Consul / Docker health probes and Prometheus scrapes. */
const INFRA_PROBE_PATHS = new Set([
  '/api/v1/health',
  '/api/v1/health/live',
  '/api/v1/health/ready',
  '/metrics',
]);

/** Fly Consul / Docker health probes and Prometheus scrapes — not app traffic. */
export function isInfraProbePath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?', 1)[0] ?? '';
  return INFRA_PROBE_PATHS.has(path);
}
