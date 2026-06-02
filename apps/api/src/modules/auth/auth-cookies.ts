import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';

export const REFRESH_COOKIE_NAME = 'forge_refresh';
/** HttpOnly session marker for middleware (not a JWT). */
export const SESSION_COOKIE_NAME = 'forge_session';

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

export function setRefreshTokenCookie(
  res: Response,
  refreshToken: string,
  configService: ConfigService,
): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(configService));
}

export function clearRefreshTokenCookie(res: Response, configService: ConfigService): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions(configService));
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

export function hasSessionCookie(req: Request): boolean {
  const v = req.cookies?.[SESSION_COOKIE_NAME];
  return v === '1' || v === 1;
}
