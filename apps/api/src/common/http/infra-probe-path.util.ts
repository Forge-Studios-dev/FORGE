/**
 * Paths that should not flood access logs when hit (manual health + Prometheus).
 * Continuous Fly probes were removed; endpoints remain for on-demand use.
 */
const INFRA_PROBE_PATHS = new Set(['/api/v1/health/live', '/metrics']);

/** Health/live and Prometheus scrapes — not normal app traffic. */
export function isInfraProbePath(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?', 1)[0] ?? '';
  return INFRA_PROBE_PATHS.has(path);
}
