import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = [
  '/studio',
  '/upload',
  '/history',
  '/notifications',
  '/library',
  '/profile/settings',
];

const PLAYLIST_PROTECTED = ['/playlists/new'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected =
    PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    PLAYLIST_PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isProtected) {
    return NextResponse.next();
  }

  const token = request.cookies.get('forge_access_token')?.value;
  if (token) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/studio/:path*',
    '/upload/:path*',
    '/history',
    '/notifications',
    '/playlists/new',
    '/playlists/new/:path*',
    '/library',
    '/profile/settings',
  ],
};
