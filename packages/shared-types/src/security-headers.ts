/** Security headers shared by web and admin Next.js apps. */

/**
 * Derives the real connect-src origins for the app's own API/WebSocket traffic
 * from its configured API URL, instead of allowing any https:/wss: host (MED-09).
 * Accepts both the public browser API URL and NEXT_PUBLIC_API_URL directly.
 */
function deriveApiConnectOrigins(apiUrl: string | undefined): string[] {
  if (!apiUrl) return [];
  try {
    const { protocol, host } = new URL(apiUrl);
    const httpOrigin = `${protocol}//${host}`;
    const wsOrigin = `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`;
    return [httpOrigin, wsOrigin];
  } catch {
    return [];
  }
}

/**
 * Builds the CSP value. `nonce` enables a nonce-based script-src (CSP3) with
 * `'unsafe-inline'` kept only as the CSP2 fallback browsers ignore once a
 * nonce is present — not a real relaxation for nonce-aware browsers.
 */
export function buildContentSecurityPolicy(
  isProduction: boolean,
  options?: { nonce?: string; apiUrl?: string },
): string {
  const scriptSrc = options?.nonce
    ? `script-src 'self' 'nonce-${options.nonce}' 'strict-dynamic' https: 'unsafe-inline' https://*.sentry.io https://www.gstatic.com`
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://www.gstatic.com";

  const connectOrigins = [
    "'self'",
    'https://*.sentry.io',
    'https://*.mux.com',
    ...deriveApiConnectOrigins(options?.apiUrl),
    ...(isProduction ? [] : ['http://localhost:*', 'ws://localhost:*']),
  ];

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.amazonaws.com https://*.cloudfront.net https://image.mux.com https://images.unsplash.com",
    "media-src 'self' blob: https://stream.mux.com https://*.amazonaws.com",
    `connect-src ${connectOrigins.join(' ')}`,
    "frame-src 'self' https://stream.mux.com",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function buildSecurityHeaders(
  isProduction: boolean,
  options?: {
    nonce?: string;
    apiUrl?: string;
    includeCsp?: boolean;
    /** When true, omit X-Frame-Options DENY so the page can be embedded. */
    allowFraming?: boolean;
  },
): Array<{ key: string; value: string }> {
  const headers: Array<{ key: string; value: string }> = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(self), microphone=(self), geolocation=(), payment=()',
    },
  ];

  if (!options?.allowFraming) {
    headers.unshift({ key: 'X-Frame-Options', value: 'DENY' });
  }

  if (options?.includeCsp ?? true) {
    const csp = buildContentSecurityPolicy(isProduction, options);
    headers.push({
      key: 'Content-Security-Policy',
      value: options?.allowFraming ? `${csp}; frame-ancestors *` : csp,
    });
  }

  if (isProduction) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    });
  }

  return headers;
}
