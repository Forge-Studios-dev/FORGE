import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decodeJwtPayload, isJwtExpired } from '@forge/shared-types/jwt';

const PUBLIC_PATHS = ['/login', '/unauthorized'];

function isValidAdminToken(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || isJwtExpired(payload)) return false;
  return payload.role === 'admin';
}

function clearAdminSession(response: NextResponse) {
  response.cookies.set('forge_admin_token', '', { path: '/', maxAge: 0 });
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('forge_admin_token')?.value;
  if (token && isValidAdminToken(token)) {
    return NextResponse.next();
  }

  if (token) {
    return clearAdminSession(NextResponse.redirect(new URL('/unauthorized', request.url)));
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
