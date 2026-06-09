/**
 * Builds TypeORM Postgres options for local Docker, Neon, or Fly.
 * When DATABASE_URL is set, host/port/user/password are omitted (avoids accidental localhost).
 */
export type DatabaseConnectionOptions = {
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  ssl: false | { rejectUnauthorized: boolean; ca?: string };
  poolMax: number;
  connectTimeoutMs: number;
  idleTimeoutMs: number;
  slowQueryMs: number;
};

function readInt(value: string | undefined, fallback: number): number {
  const n = parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

export function isNeonDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.includes('neon.tech') ||
    url.includes('.neon.database') ||
    url.includes('neon.database')
  );
}

/** Neon pooled URLs use `-pooler` in the hostname (required for Fly/serverless). */
export function isNeonPooledDatabaseUrl(url: string | undefined): boolean {
  if (!url || !isNeonDatabaseUrl(url)) return true;
  try {
    const normalized = url.replace(/^postgres(ql)?:\/\//, 'https://');
    const hostname = new URL(normalized).hostname;
    return hostname.includes('-pooler');
  } catch {
    return url.includes('-pooler.');
  }
}

/**
 * Production guard: Neon must use the pooler endpoint unless explicitly overridden
 * (one-off migrations / CLI only — never for long-running API/worker processes).
 */
export function validateNeonPoolerUrlForProduction(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if ((env.NODE_ENV || 'development') !== 'production') return;
  if (env.DATABASE_ALLOW_DIRECT_NEON === 'true') return;

  const url = env.DATABASE_URL?.trim();
  if (!url || !isNeonDatabaseUrl(url)) return;

  if (!isNeonPooledDatabaseUrl(url)) {
    throw new Error(
      'Production Neon DATABASE_URL must use the pooled endpoint (-pooler in hostname). ' +
        'Use the connection string from Neon dashboard → Connection pooling. ' +
        'Set DATABASE_ALLOW_DIRECT_NEON=true only for ephemeral migration/CLI tasks.',
    );
  }
}

export function databaseRequiresSsl(url: string | undefined, nodeEnv?: string): boolean {
  if (process.env.DATABASE_SSL === 'true') return true;
  if (nodeEnv === 'production') return true;
  if (!url) return false;
  if (isNeonDatabaseUrl(url)) return true;
  return url.includes('sslmode=require') || url.includes('sslmode=verify-full');
}

function buildSslConfig(
  env: NodeJS.ProcessEnv,
  url: string | undefined,
  nodeEnv: string,
): false | { rejectUnauthorized: boolean; ca?: string } {
  if (!databaseRequiresSsl(url, nodeEnv)) return false;

  const rejectUnauthorized =
    nodeEnv === 'production'
      ? env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'
      : env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true';

  const ca = env.DATABASE_SSL_CA?.trim();
  return {
    rejectUnauthorized,
    ...(ca ? { ca } : {}),
  };
}

export function parseDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseConnectionOptions {
  const url = env.DATABASE_URL?.trim();
  const nodeEnv = env.NODE_ENV || 'development';
  const isNeon = isNeonDatabaseUrl(url);
  const poolMax = readInt(env.DB_POOL_MAX, isNeon ? 5 : 20);
  const connectTimeoutMs = readInt(env.DB_CONNECT_TIMEOUT_MS, 10_000);
  const idleTimeoutMs = readInt(env.DB_POOL_IDLE_TIMEOUT_MS, isNeon ? 30_000 : 10_000);
  const slowQueryMs = readInt(env.DB_SLOW_QUERY_MS, 2000);
  const ssl = buildSslConfig(env, url, nodeEnv);

  if (url) {
    return { url, ssl, poolMax, connectTimeoutMs, idleTimeoutMs, slowQueryMs };
  }

  return {
    host: env.DB_HOST || 'localhost',
    port: readInt(env.DB_PORT, 5432),
    username: env.DB_USERNAME || 'forge',
    password: env.DB_PASSWORD || 'forge',
    database: env.DB_NAME || 'forge_db',
    ssl,
    poolMax,
    connectTimeoutMs,
    idleTimeoutMs,
    slowQueryMs,
  };
}
