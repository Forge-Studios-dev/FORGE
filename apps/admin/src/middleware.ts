import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decodeJwtPayload, isJwtExpired } from '@forge/shared-types/jwt';
import { buildContentSecurityPolicy } from '@forge/shared-types/security-headers';

const PUBLIC_PATHS = ['/login', '/unauthorized'];
const SESSION_MARKER = 'forge_admin_session';

function isValidAdminToken(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || isJwtExpired(payload)) return false;
  return payload.role === 'admin';
}

function clearAdminSession(response: NextResponse) {
  response.cookies.set('forge_admin_token', '', { path: '/', maxAge: 0 });
  response.cookies.set(SESSION_MARKER, '', { path: '/', maxAge: 0 });
  return response;
}

/**
 * Applies a per-request nonce-based CSP to every response this middleware returns.
 * Falls back to a nonce-less CSP (old behavior) if nonce generation ever throws in
 * a runtime without Web Crypto/Buffer, rather than failing the whole request.
 */
function withCsp(response: NextResponse): NextResponse {
  const isProduction = process.env.NODE_ENV === 'production';
  let nonce: string | undefined;
  try {
    nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  } catch {
    nonce = undefined;
  }
  response.headers.set(
    'Content-Security-Policy',
    buildContentSecurityPolicy(isProduction, {
      nonce,
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
    }),
  );
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return withCsp(NextResponse.next());
  }

  const token = request.cookies.get('forge_admin_token')?.value;
  const hasSessionMarker = request.cookies.get(SESSION_MARKER)?.value === '1';

  if (token && isValidAdminToken(token)) {
    return withCsp(NextResponse.next());
  }

  if (hasSessionMarker && token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return withCsp(NextResponse.redirect(loginUrl));
  }

  if (token) {
    return withCsp(clearAdminSession(NextResponse.redirect(new URL('/unauthorized', request.url))));
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return withCsp(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
