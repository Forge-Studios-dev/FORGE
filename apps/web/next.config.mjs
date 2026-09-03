import { withSentryConfig } from '@sentry/nextjs';
import { buildSecurityHeaders } from '@forge/shared-types/security-headers';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@forge/design-system', '@forge/shared-types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.cloudfront.net' },
      { protocol: 'https', hostname: 'cdn.forge.app' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'image.mux.com' },
      { protocol: 'https', hostname: 'stream.mux.com' },
    ],
  },
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';
    // CSP is set per-request (with a nonce) by middleware.ts, not here.
    const common = buildSecurityHeaders(isProduction, { includeCsp: false });
    const embed = buildSecurityHeaders(isProduction, {
      includeCsp: false,
      allowFraming: true,
    });
    return [
      {
        source: '/embed/:path*',
        headers: embed,
      },
      {
        // Apply DENY framing to everything except /embed/*
        source: '/:path((?!embed(?:/|$)).*)',
        headers: common,
      },
    ];
  },
  /**
   * Retired skill-economy Studio routes (not selective P2/P3 modules).
   * Courses, mentorship, and channel-points stay routable when feature flags are on.
   */
  async redirects() {
    const studioOrphans = [
      '/studio/podcasts',
      '/studio/brands',
      '/studio/bundles',
      '/studio/resources',
      '/studio/referrals',
      '/studio/communities',
      '/studio/communities/:path*',
      '/studio/ai-copilot',
      '/studio/system-states',
    ];
    const studioAliasRedirects = [
      { source: '/studio/rooms', destination: '/studio/community' },
      { source: '/studio/engagement', destination: '/studio/community' },
      { source: '/studio/programs', destination: '/studio/courses?tab=programs' },
      { source: '/studio/programs/:path*', destination: '/studio/courses?tab=programs' },
    ];
    const publicOrphans = [
      { source: '/podcasts', destination: '/' },
      { source: '/podcasts/:path*', destination: '/' },
      { source: '/courses', destination: '/discover/courses' },
    ];
    return [
      ...studioOrphans.map((source) => ({
        source,
        destination: '/studio',
        permanent: false,
      })),
      ...studioAliasRedirects.map((r) => ({ ...r, permanent: false })),
      ...publicOrphans.map((r) => ({ ...r, permanent: false })),
    ];
  },
};

const sentryWebpackPluginOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT_WEB || process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
