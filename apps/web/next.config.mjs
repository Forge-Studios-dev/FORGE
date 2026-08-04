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
   * Skill-economy Studio orphans → YouTube Studio core.
   * Pages may still exist on disk; redirects keep bookmarks from landing on non-YT IA.
   */
  async redirects() {
    const studioOrphans = [
      '/studio/courses',
      '/studio/courses/:path*',
      '/studio/podcasts',
      '/studio/mentorship',
      '/studio/brands',
      '/studio/bundles',
      '/studio/programs',
      '/studio/programs/:path*',
      '/studio/resources',
      '/studio/referrals',
      '/studio/channel-points',
      '/studio/communities',
      '/studio/communities/:path*',
      '/studio/community',
      '/studio/ai-copilot',
      '/studio/system-states',
    ];
    const publicOrphans = [
      { source: '/podcasts', destination: '/' },
      { source: '/podcasts/:path*', destination: '/' },
      { source: '/courses', destination: '/' },
      { source: '/courses/:path*', destination: '/' },
      { source: '/discover/courses', destination: '/explore' },
      { source: '/discover/courses/:path*', destination: '/explore' },
      { source: '/:username/programs/:slug', destination: '/:username' },
    ];
    return [
      ...studioOrphans.map((source) => ({
        source,
        destination: '/studio',
        permanent: false,
      })),
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
