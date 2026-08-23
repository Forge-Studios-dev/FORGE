import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decodeJwtPayload } from '@forge/shared-types/jwt';
import {
  accessTokenAllowsCreatorUpload,
  accessTokenIsEmailVerified,
  isValidConsumerAccessToken,
} from '@forge/shared-types/consumer-session';
import { buildContentSecurityPolicy } from '@forge/shared-types/security-headers';
import { MAX_RETURN_PATH_LEN } from '@/lib/safe-return-path';

function generateNonce(): string | undefined {
  try {
    return Buffer.from(crypto.randomUUID()).toString('base64');
  } catch {
    return undefined;
  }
}

/**
 * Applies the CSP header for a given nonce (or no nonce, on the Web
 * Crypto/Buffer-unavailable fallback path).
 */
function applyCsp(response: NextResponse, nonce: string | undefined, allowFraming = false): NextResponse {
  const isProduction = process.env.NODE_ENV === 'production';
  let csp = buildContentSecurityPolicy(isProduction, {
    nonce,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
  });
  if (allowFraming) {
    csp = `${csp}; frame-ancestors *`;
  }
  response.headers.set('Content-Security-Policy', csp);
  if (allowFraming) {
    response.headers.delete('X-Frame-Options');
  }
  return response;
}

/**
 * `NextResponse.next()`, but threading the nonce through the request headers
 * too — not just the response CSP header — so Next's own script-tag
 * injection can read it via `headers()` in the root layout (see Next's CSP
 * guide). Without this, Next never learns the nonce, so its own bootstrap
 * scripts render without a matching `nonce` attribute and the browser blocks
 * them outright, breaking hydration on every page.
 */
function nextWithNonceRequest(request: NextRequest, nonce: string | undefined): NextResponse {
  if (!nonce) return NextResponse.next();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

const PROTECTED_PREFIXES = [
  '/studio',
  '/upload',
  '/history',
  '/notifications',
  '/library',
  '/profile',
  '/messages',
  '/playlists/me',
  '/settings',
];

const PLAYLIST_PROTECTED = ['/playlists/new'];

const ADMIN_ROUTE_PREFIXES = ['/admin'];

/** Upload paths that require creator role in JWT (not become-creator apply flow). */
function requiresCreatorRole(pathname: string): boolean {
  if (pathname.startsWith('/upload/become-creator')) return false;
  if (pathname === '/upload' || pathname.startsWith('/upload/')) return true;
  return false;
}

function buildReturnPath(request: NextRequest): string {
  const { pathname, search } = request.nextUrl;
  const full = `${pathname}${search}`;
  return full.length > MAX_RETURN_PATH_LEN ? full.slice(0, MAX_RETURN_PATH_LEN) : full;
}

const SESSION_COOKIE = 'forge_session';

function clearConsumerSession(response: NextResponse) {
  response.cookies.set('forge_access_token', '', { path: '/', maxAge: 0 });
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}

function hasSessionMarker(request: NextRequest): boolean {
  return request.cookies.get(SESSION_COOKIE)?.value === '1';
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const allowFraming = request.nextUrl.pathname.startsWith('/embed');
  const withCsp = (response: NextResponse) => applyCsp(response, nonce, allowFraming);

  const host = request.headers.get('host') ?? '';
  if (host.startsWith('www.')) {
    const apexHost = host.slice(4);
    const dest = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${apexHost}`);
    return withCsp(NextResponse.redirect(dest, 308));
  }

  const { pathname } = request.nextUrl;

  if (ADMIN_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return withCsp(NextResponse.redirect(new URL('/', request.url)));
  }

  const token = request.cookies.get('forge_access_token')?.value;
  const tokenValid = isValidConsumerAccessToken(token);
  const payload = token ? decodeJwtPayload(token) : null;
  const hasSession = hasSessionMarker(request);

  if (tokenValid && payload?.role === 'admin') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'platform_admin');
    return withCsp(clearConsumerSession(NextResponse.redirect(loginUrl)));
  }

  // Treat the HttpOnly session marker as the source of truth for "this browser has a live session".
  // Access JWTs are short-lived and are expected to be silently refreshed via HttpOnly refresh cookie.
  const sessionPresent = hasSession || tokenValid;

  if (token && !tokenValid && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', buildReturnPath(request));
    return withCsp(clearConsumerSession(NextResponse.redirect(loginUrl)));
  }

  const isProtected =
    PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    PLAYLIST_PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !sessionPresent) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', buildReturnPath(request));
    return withCsp(NextResponse.redirect(loginUrl));
  }

  if (requiresCreatorRole(pathname) && tokenValid && !accessTokenAllowsCreatorUpload(token!)) {
    return withCsp(NextResponse.redirect(new URL('/upload/become-creator', request.url)));
  }

  if (
    requiresCreatorRole(pathname) &&
    tokenValid &&
    accessTokenAllowsCreatorUpload(token!) &&
    !accessTokenIsEmailVerified(token!)
  ) {
    return withCsp(NextResponse.redirect(new URL('/verify-email', request.url)));
  }

  return withCsp(nextWithNonceRequest(request, nonce));
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)',
  ],
};
