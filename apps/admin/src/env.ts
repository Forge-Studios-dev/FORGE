import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001/api/v1'),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().optional(),
    NEXT_PUBLIC_APP_CHECK_SITE_KEY: z.string().optional(),
    NEXT_PUBLIC_FIREBASE_API_KEY: z.string().optional(),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
    NEXT_PUBLIC_FIREBASE_APP_ID: z.string().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    NEXT_PUBLIC_APP_CHECK_SITE_KEY: process.env.NEXT_PUBLIC_APP_CHECK_SITE_KEY,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
  emptyStringAsUndefined: true,
});
