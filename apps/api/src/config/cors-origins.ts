/** Shared production CORS origins for HTTP and Socket.IO. */
export function productionCorsOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  return [
    env.WEB_URL,
    env.ADMIN_URL,
    'https://forgestudios.net',
    'https://www.forgestudios.net',
    'https://admin.forgestudios.net',
  ]
    .map((o) => (typeof o === 'string' ? o.trim() : ''))
    .filter((o) => o.length > 0)
    .filter((o, i, arr) => arr.indexOf(o) === i);
}

/**
 * Explicit allowlist for non-production (dev/staging) CORS instead of `origin: '*'` (LOW-01).
 * A browser rejects `*` with `credentials: true` in practice, but an internet-reachable
 * staging env with a misconfigured NODE_ENV would otherwise be fully open. Includes the
 * repo's actual dev ports (web:3000, admin:3002) plus any explicit WEB_URL/ADMIN_URL override.
 */
export function devCorsOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  return [
    env.WEB_URL,
    env.ADMIN_URL,
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3002',
  ]
    .map((o) => (typeof o === 'string' ? o.trim() : ''))
    .filter((o) => o.length > 0)
    .filter((o, i, arr) => arr.indexOf(o) === i);
}
