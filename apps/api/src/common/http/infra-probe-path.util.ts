/**
 * Paths that should not flood access logs.
 * Prometheus scrapes `/metrics` on demand (Grafana interval — not app code).
 */
const INFRA_PROBE_PATHS = new Set(['/metrics']);

/** Prometheus scrapes — not normal app traffic. */
export function isInfraProbePath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?', 1)[0] ?? '';
  return INFRA_PROBE_PATHS.has(path);
}
