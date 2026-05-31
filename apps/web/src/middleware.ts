import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decodeJwtPayload } from '@forge/shared-types/jwt';
import {
  accessTokenAllowsCreatorUpload,
  accessTokenIsEmailVerified,
  isValidConsumerAccessToken,
} from '@forge/shared-types/consumer-session';
import { MAX_RETURN_PATH_LEN } from '@/lib/safe-return-path';

const PROTECTED_PREFIXES = [
  '/studio',
  '/upload',
  '/history',
  '/notifications',
  '/library',
  '/profile',
  '/profile/settings',
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
  const host = request.headers.get('host') ?? '';
  if (host.startsWith('www.')) {
    const apexHost = host.slice(4);
    const dest = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${apexHost}`);
    return NextResponse.redirect(dest, 308);
  }

  const { pathname } = request.nextUrl;

  if (ADMIN_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const token = request.cookies.get('forge_access_token')?.value;
  const payload = token ? decodeJwtPayload(token) : null;

  if (token && payload?.role === 'admin') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'platform_admin');
    return clearConsumerSession(NextResponse.redirect(loginUrl));
  }

  const sessionValid =
    isValidConsumerAccessToken(token) &&
    (!request.cookies.has(SESSION_COOKIE) || hasSessionMarker(request));

  if (token && !sessionValid) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', buildReturnPath(request));
    return clearConsumerSession(NextResponse.redirect(loginUrl));
  }

  const isProtected =
    PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    PLAYLIST_PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && (!token || !sessionValid)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', buildReturnPath(request));
    return NextResponse.redirect(loginUrl);
  }

  if (requiresCreatorRole(pathname) && token && sessionValid && !accessTokenAllowsCreatorUpload(token)) {
    return NextResponse.redirect(new URL('/upload/become-creator', request.url));
  }

  if (
    requiresCreatorRole(pathname) &&
    token &&
    sessionValid &&
    accessTokenAllowsCreatorUpload(token) &&
    !accessTokenIsEmailVerified(token)
  ) {
    return NextResponse.redirect(new URL('/verify-email', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
