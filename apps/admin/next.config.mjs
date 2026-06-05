import { withSentryConfig } from '@sentry/nextjs';
import { buildSecurityHeaders } from '@forge/shared-types/security-headers';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@forge/design-system'],
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';
    return [
      {
        source: '/(.*)',
        headers: buildSecurityHeaders(isProduction),
      },
    ];
  },
};

const sentryWebpackPluginOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT_ADMIN || process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  hideSourceMaps: true,
  disableLogger: true,
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
