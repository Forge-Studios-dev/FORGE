/** Fly Consul / Docker health probes and Prometheus scrapes — not app traffic. */
export function isInfraProbePath(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.includes('/health/live') ||
    url.includes('/health/ready') ||
    url === '/api/v1/health' ||
    url.startsWith('/api/v1/health?') ||
    url === '/metrics' ||
    url.startsWith('/metrics?')
  );
}
