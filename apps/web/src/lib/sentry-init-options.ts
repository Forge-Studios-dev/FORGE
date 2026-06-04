import type * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function sentryEnabled(): boolean {
  return !!dsn;
}

export function buildSentryOptions(): Sentry.BrowserOptions | Sentry.NodeOptions {
  return {
    dsn,
    enabled: !!dsn,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    sendDefaultPii: process.env.NEXT_PUBLIC_SENTRY_SEND_DEFAULT_PII !== 'false',
  };
}
