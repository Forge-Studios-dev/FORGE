/**
 * Redis TLS options. In production, verify server certificates unless explicitly disabled
 * (e.g. some managed Redis providers with custom CAs — set REDIS_TLS_REJECT_UNAUTHORIZED=false).
 */
export function redisTlsOptions(
  redisUrl: string,
  nodeEnv: string,
): { tls: { rejectUnauthorized: boolean } } | undefined {
  if (!redisUrl.startsWith('rediss://')) return undefined;
  const envFlag = process.env.REDIS_TLS_REJECT_UNAUTHORIZED;
  const rejectUnauthorized =
    envFlag !== undefined ? envFlag !== 'false' : nodeEnv === 'production';
  return { tls: { rejectUnauthorized } };
}
