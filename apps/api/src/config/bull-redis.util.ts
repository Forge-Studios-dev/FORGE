import type { ConnectionOptions } from 'bullmq';

/**
 * BullMQ uses ioredis-style options; parse REDIS_URL so auth (requirepass / ACL) works in production.
 */
export function bullMqConnectionFromRedisUrl(redisUrl: string): ConnectionOptions {
  try {
    const u = new URL(redisUrl);
    const port = u.port ? parseInt(u.port, 10) : 6379;
    const conn: ConnectionOptions = {
      host: u.hostname || 'localhost',
      port,
    };
    if (u.password) {
      conn.password = decodeURIComponent(u.password);
    }
    if (u.username) {
      conn.username = decodeURIComponent(u.username);
    }
    return conn;
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

export function bullMqConnectionFromConfig(config: {
  url?: string;
  host: string;
  port: number;
  password?: string;
}): ConnectionOptions {
  const pwd = config.password?.trim() || undefined;
  if (config.url) {
    const conn = bullMqConnectionFromRedisUrl(config.url) as Record<string, unknown>;
    if (pwd && !conn.password) {
      return { ...conn, password: pwd } as ConnectionOptions;
    }
    return conn as ConnectionOptions;
  }
  return {
    host: config.host,
    port: config.port,
    ...(pwd ? { password: pwd } : {}),
  };
}
