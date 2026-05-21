import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decodeJwtPayload, isJwtExpired } from '@forge/shared-types/jwt';

const PROTECTED_PREFIXES = [
  '/studio',
  '/upload',
  '/history',
  '/notifications',
  '/library',
  '/profile/settings',
];

const PLAYLIST_PROTECTED = ['/playlists/new'];

const ADMIN_ROUTE_PREFIXES = ['/admin'];

function isPlatformAdminToken(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || isJwtExpired(payload)) return false;
  return payload.role === 'admin';
}

function clearConsumerSession(response: NextResponse) {
  response.cookies.set('forge_access_token', '', { path: '/', maxAge: 0 });
  return response;
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
  if (token && isPlatformAdminToken(token)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'platform_admin');
    return clearConsumerSession(NextResponse.redirect(loginUrl));
  }

  const isProtected =
    PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    PLAYLIST_PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isProtected) {
    return NextResponse.next();
  }

  if (token) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
