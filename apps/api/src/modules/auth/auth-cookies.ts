import { timingSafeEqual, randomBytes } from 'crypto';
import { Response, Request } from 'express';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const REFRESH_COOKIE_NAME = 'forge_refresh';
export const CSRF_COOKIE_NAME = 'forge_csrf';
export const CSRF_HEADER_NAME = 'x-forge-csrf';
/** HttpOnly session marker for middleware (not a JWT). */
export const SESSION_COOKIE_NAME = 'forge_session';
/**
 * HttpOnly mirror of the access token, read by Next.js edge middleware to decode
 * role/permission claims for route guards. Server-set only (MED-10) — client JS
 * never writes this cookie, so an XSS payload can't read it via document.cookie.
 * The real bearer token for Authorization headers still lives in sessionStorage.
 */
export const ACCESS_COOKIE_NAME = 'forge_access_token';

const DEFAULT_REFRESH_TTL_DAYS = 30;

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function refreshTtlMs(configService: ConfigService): number {
  // Accepts values like "30d" or "30" (days). Matches `jwt.refreshExpiresIn`.
  const raw = configService.get<string>('jwt.refreshExpiresIn')?.trim();
  const days = clampInt(parseInt(raw || `${DEFAULT_REFRESH_TTL_DAYS}`, 10), 1, 365);
  return days * 24 * 60 * 60 * 1000;
}

function sessionCookieDomain(configService: ConfigService) {
  const nodeEnv = configService.get<string>('nodeEnv');
  const isProd = nodeEnv === 'production';
  const configuredDomain = configService.get<string>('auth.refreshCookieDomain')?.trim();
  return configuredDomain || (isProd ? '.forgestudios.net' : undefined);
}

function refreshCookieOptions(configService: ConfigService) {
  const nodeEnv = configService.get<string>('nodeEnv');
  const isProd = nodeEnv === 'production';
  const configuredDomain = configService.get<string>('auth.refreshCookieDomain')?.trim();
  const domain =
    configuredDomain ||
    (isProd ? '.forgestudios.net' : undefined);
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/api/v1/auth',
    maxAge: refreshTtlMs(configService),
    ...(domain ? { domain } : {}),
  };
}

function csrfCookieOptions(configService: ConfigService) {
  const nodeEnv = configService.get<string>('nodeEnv');
  const isProd = nodeEnv === 'production';
  const domain = sessionCookieDomain(configService);
  return {
    httpOnly: false,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: refreshTtlMs(configService),
    ...(domain ? { domain } : {}),
  };
}

function newCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function setCsrfCookie(res: Response, configService: ConfigService, token?: string): void {
  res.cookie(CSRF_COOKIE_NAME, token ?? newCsrfToken(), csrfCookieOptions(configService));
}

export function clearCsrfCookie(res: Response, configService: ConfigService): void {
  res.clearCookie(CSRF_COOKIE_NAME, csrfCookieOptions(configService));
}

export function setRefreshTokenCookie(
  res: Response,
  refreshToken: string,
  configService: ConfigService,
): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(configService));
  setCsrfCookie(res, configService);
}

export function clearRefreshTokenCookie(res: Response, configService: ConfigService): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions(configService));
  clearCsrfCookie(res, configService);
}

/** F-802: double-submit CSRF when refresh uses HttpOnly cookie (production cross-site SPA). */
export function assertCookieRefreshCsrf(
  req: Request,
  configService: ConfigService,
  bodyToken?: string,
): void {
  if (bodyToken?.trim()) return;
  const nodeEnv = configService.get<string>('nodeEnv');
  if (nodeEnv !== 'production') return;

  const refresh = req.cookies?.[REFRESH_COOKIE_NAME];
  if (typeof refresh !== 'string' || refresh.length === 0) return;

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerRaw = req.headers[CSRF_HEADER_NAME];
  const headerToken = typeof headerRaw === 'string' ? headerRaw.trim() : '';

  if (
    typeof cookieToken !== 'string' ||
    cookieToken.length === 0 ||
    headerToken.length === 0 ||
    cookieToken.length !== headerToken.length
  ) {
    throw new ForbiddenException('CSRF token required for cookie-based refresh');
  }

  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (!timingSafeEqual(a, b)) {
    throw new ForbiddenException('Invalid CSRF token');
  }
}

export function readRefreshTokenFromRequest(req: Request, bodyToken?: string): string | null {
  const fromBody = bodyToken?.trim();
  if (fromBody) return fromBody;
  const fromCookie = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof fromCookie === 'string' && fromCookie.length > 0 ? fromCookie : null;
}

function sessionCookieOptions(configService: ConfigService) {
  const nodeEnv = configService.get<string>('nodeEnv');
  const isProd = nodeEnv === 'production';
  const domain = sessionCookieDomain(configService);
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: refreshTtlMs(configService),
    ...(domain ? { domain } : {}),
  };
}

export function setSessionCookie(res: Response, configService: ConfigService): void {
  res.cookie(SESSION_COOKIE_NAME, '1', sessionCookieOptions(configService));
}

export function clearSessionCookie(res: Response, configService: ConfigService): void {
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions(configService));
}

export function setAccessTokenCookie(
  res: Response,
  accessToken: string,
  configService: ConfigService,
): void {
  // Same shape as the session marker cookie (httpOnly, shared domain) — the
  // JWT's own expiry claim is what actually gates access, not this cookie's maxAge.
  res.cookie(ACCESS_COOKIE_NAME, accessToken, sessionCookieOptions(configService));
}

export function clearAccessTokenCookie(res: Response, configService: ConfigService): void {
  res.clearCookie(ACCESS_COOKIE_NAME, sessionCookieOptions(configService));
}

/** Admin app's equivalent of forge_access_token/forge_session — same MED-10 fix, higher-privilege app. */
export const ADMIN_TOKEN_COOKIE_NAME = 'forge_admin_token';
export const ADMIN_SESSION_COOKIE_NAME = 'forge_admin_session';

export function setAdminAuthCookies(
  res: Response,
  accessToken: string,
  configService: ConfigService,
): void {
  const options = sessionCookieOptions(configService);
  res.cookie(ADMIN_TOKEN_COOKIE_NAME, accessToken, options);
  res.cookie(ADMIN_SESSION_COOKIE_NAME, '1', options);
}

export function clearAdminAuthCookies(res: Response, configService: ConfigService): void {
  const options = sessionCookieOptions(configService);
  res.clearCookie(ADMIN_TOKEN_COOKIE_NAME, options);
  res.clearCookie(ADMIN_SESSION_COOKIE_NAME, options);
}

export function hasSessionCookie(req: Request): boolean {
  const v = req.cookies?.[SESSION_COOKIE_NAME];
  return v === '1' || v === 1;
}
