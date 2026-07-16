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
 * Threads the nonce through the request headers (not just the response CSP
 * header) so Next's own script-tag injection picks it up via `headers()` in
 * the root layout — see Next's CSP guide. A response-header-only nonce
 * silently breaks every page: Next never learns the nonce, so its own
 * bootstrap scripts render without a matching `nonce` attribute and the
 * browser blocks them outright.
 */
function nextWithNonceRequest(request: NextRequest, nonce: string | undefined): NextResponse {
  if (!nonce) return NextResponse.next();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProduction = process.env.NODE_ENV === 'production';
  let nonce: string | undefined;
  try {
    nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  } catch {
    nonce = undefined;
  }
  const csp = buildContentSecurityPolicy(isProduction, {
    nonce,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
  });
  const applyCsp = (response: NextResponse): NextResponse => {
    response.headers.set('Content-Security-Policy', csp);
    return response;
  };

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return applyCsp(nextWithNonceRequest(request, nonce));
  }

  const token = request.cookies.get('forge_admin_token')?.value;
  const hasSessionMarker = request.cookies.get(SESSION_MARKER)?.value === '1';

  if (token && isValidAdminToken(token)) {
    return applyCsp(nextWithNonceRequest(request, nonce));
  }

  if (hasSessionMarker && token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return applyCsp(NextResponse.redirect(loginUrl));
  }

  if (token) {
    return applyCsp(clearAdminSession(NextResponse.redirect(new URL('/unauthorized', request.url))));
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return applyCsp(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
