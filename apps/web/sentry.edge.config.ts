import * as Sentry from '@sentry/nextjs';
import { buildSentryOptions } from './src/lib/sentry-init-options';

Sentry.init(buildSentryOptions());
