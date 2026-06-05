/** Security headers shared by web and admin Next.js apps. */
export function buildSecurityHeaders(isProduction: boolean): Array<{ key: string; value: string }> {
  const headers: Array<{ key: string; value: string }> = [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(self), microphone=(self), geolocation=(), payment=()',
    },
    {
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://www.gstatic.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://*.amazonaws.com https://*.cloudfront.net https://image.mux.com https://images.unsplash.com",
        "media-src 'self' blob: https://stream.mux.com https://*.amazonaws.com",
        "connect-src 'self' https://*.sentry.io https://*.mux.com wss: https:",
        "frame-src 'self' https://stream.mux.com",
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    },
  ];

  if (isProduction) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    });
  }

  return headers;
}
