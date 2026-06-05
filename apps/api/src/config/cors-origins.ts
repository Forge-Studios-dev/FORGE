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
