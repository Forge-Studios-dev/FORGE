import { z } from 'zod';
import { validateNeonPoolerUrlForProduction } from '../database/parse-database-config';

const INSECURE_JWT_SECRETS = new Set([
  'jwt-secret-change-in-production',
  'jwt-refresh-secret-change-in-production',
]);

const secretMin32 = z
  .string()
  .min(32, 'must be at least 32 characters')
  .refine((v) => !INSECURE_JWT_SECRETS.has(v), 'must not use default placeholder value');

/** True when enough Firebase Admin credentials exist to initialize the SDK. */
export function hasFirebaseAdminCredentials(env: NodeJS.ProcessEnv): boolean {
  return (
    !!env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
    env.FIREBASE_USE_APPLICATION_DEFAULT === 'true' ||
    (!!env.FIREBASE_PROJECT_ID?.trim() &&
      !!env.FIREBASE_CLIENT_EMAIL?.trim() &&
      !!env.FIREBASE_PRIVATE_KEY?.trim())
  );
}

/** Validates raw process.env in production. Throws with aggregated errors on failure. */
export function validateProductionEnv(env: NodeJS.ProcessEnv = process.env): void {
  if ((env.NODE_ENV || 'development') !== 'production') return;

  const base = z.object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required in production'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required in production'),
    JWT_SECRET: secretMin32,
    JWT_REFRESH_SECRET: secretMin32,
    WEB_URL: z.string().url('WEB_URL must be a valid URL'),
    ADMIN_URL: z.string().url('ADMIN_URL must be a valid URL'),
    MUX_TOKEN_ID: z.string().min(1, 'MUX_TOKEN_ID is required in production'),
    MUX_TOKEN_SECRET: z.string().min(1, 'MUX_TOKEN_SECRET is required in production'),
    MUX_WEBHOOK_SECRET: z.string().min(1, 'MUX_WEBHOOK_SECRET is required in production'),
    VIDEO_TRANSCODE_PROVIDER: z.enum(['mux'], {
      message: 'Production requires VIDEO_TRANSCODE_PROVIDER=mux',
    }),
    METRICS_SCRAPE_TOKEN: z
      .string()
      .min(1, 'METRICS_SCRAPE_TOKEN is required in production (/metrics fails closed without it)'),
  });

  const parsed = base.safeParse(env);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Production environment validation failed:\n${messages.join('\n')}`);
  }

  if (env.MUX_TOKEN_ID?.trim() && !env.MUX_WEBHOOK_SECRET?.trim()) {
    throw new Error('MUX_WEBHOOK_SECRET is required when MUX_TOKEN_ID is set');
  }

  if (env.FCM_ENABLED === 'true' && !hasFirebaseAdminCredentials(env)) {
    throw new Error(
      'FCM_ENABLED=true requires Firebase credentials (service account JSON or individual fields)',
    );
  }

  // Independent of FCM — App Check verify needs Admin even when push is off.
  if (env.APP_CHECK_ENABLED === 'true' && !hasFirebaseAdminCredentials(env)) {
    throw new Error(
      'APP_CHECK_ENABLED=true requires Firebase Admin credentials (otherwise guarded routes fail closed)',
    );
  }

  const hasSmtp = !!env.SMTP_HOST?.trim() && !!env.SMTP_PASS?.trim();
  const hasResend = !!env.RESEND_API_KEY?.trim();
  if (!hasSmtp && !hasResend && env.MAIL_FROM && !env.MAIL_FROM.includes('localhost')) {
    throw new Error(
      'Production mail requires SMTP_HOST+SMTP_PASS or RESEND_API_KEY when MAIL_FROM is set',
    );
  }

  if (env.GOOGLE_OAUTH_ENABLED === 'true') {
    if (!env.GOOGLE_CLIENT_ID?.trim() || !env.GOOGLE_CLIENT_SECRET?.trim()) {
      throw new Error('GOOGLE_OAUTH_ENABLED=true requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    }
  }

  const hasAws =
    !!env.AWS_ACCESS_KEY_ID?.trim() &&
    !!env.AWS_SECRET_ACCESS_KEY?.trim() &&
    !!env.S3_BUCKET_NAME?.trim();
  if (!hasAws) {
    throw new Error(
      'Production requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME for uploads',
    );
  }

  if (env.MOCK_SUBSCRIPTIONS_ENABLED === 'true') {
    throw new Error('MOCK_SUBSCRIPTIONS_ENABLED must not be true in production');
  }

  const scanProvider = (env.CONTENT_SCAN_PROVIDER || 'none').trim().toLowerCase();
  if (scanProvider === 'webhook') {
    if (!env.CONTENT_SCAN_WEBHOOK_URL?.trim()) {
      throw new Error(
        'CONTENT_SCAN_PROVIDER=webhook requires CONTENT_SCAN_WEBHOOK_URL (no silent noop fallback in production)',
      );
    }
  } else if (scanProvider === 'none' || scanProvider === '') {
    if (env.CONTENT_SCAN_ALLOW_NOOP !== 'true') {
      throw new Error(
        'Production CONTENT_SCAN_PROVIDER=none requires CONTENT_SCAN_ALLOW_NOOP=true (ADR-012). Wire a vendor webhook or explicitly acknowledge that uploads are not vendor-scanned.',
      );
    }
  } else {
    throw new Error(`Unknown CONTENT_SCAN_PROVIDER=${scanProvider}`);
  }

  validateNeonPoolerUrlForProduction(env);
}
