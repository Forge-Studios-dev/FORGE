/**
 * Load before any other app modules so Sentry / OTel can instrument the process.
 */
import * as Sentry from '@sentry/nestjs';
import { bootstrapOpenTelemetry } from './otel-bootstrap';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Math.min(1, Math.max(0, parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0'))),
  });
}

void bootstrapOpenTelemetry().catch((err) => {
  console.error('OpenTelemetry bootstrap failed', err);
});
