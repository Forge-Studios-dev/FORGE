import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import {
  ACCESS_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_TOKEN_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  assertCookieRefreshCsrf,
  readRefreshTokenFromRequest,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  setSessionCookie,
  clearSessionCookie,
  setAccessTokenCookie,
  clearAccessTokenCookie,
  setAdminAuthCookies,
  clearAdminAuthCookies,
  hasSessionCookie,
} from './auth-cookies';

describe('auth-cookies', () => {
  const config = {
    get: (key: string) => {
      if (key === 'nodeEnv') return 'development';
      if (key === 'auth.refreshCookieDomain') return '';
      return undefined;
    },
  } as unknown as ConfigService;

  const prodConfig = {
    get: (key: string) => {
      if (key === 'nodeEnv') return 'production';
      if (key === 'auth.refreshCookieDomain') return '.forgestudios.net';
      return undefined;
    },
  } as unknown as ConfigService;

  it('setRefreshTokenCookie sets httpOnly forge_refresh and forge_csrf', () => {
    const cookies: Record<string, unknown> = {};
    const res = {
      cookie: jest.fn((name: string, value: string, opts: Record<string, unknown>) => {
        cookies[name] = { value, opts };
      }),
      clearCookie: jest.fn(),
    } as unknown as Response;

    setRefreshTokenCookie(res, 'raw-token', config);
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'raw-token',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: false, path: '/' }),
    );
  });

  it('assertCookieRefreshCsrf skips in development', () => {
    const req = {
      cookies: { [REFRESH_COOKIE_NAME]: 'r' },
      headers: {},
    } as unknown as import('express').Request;
    expect(() => assertCookieRefreshCsrf(req, config)).not.toThrow();
  });

  it('assertCookieRefreshCsrf requires matching header in production', () => {
    const token = 'a'.repeat(64);
    const req = {
      cookies: { [REFRESH_COOKIE_NAME]: 'r', [CSRF_COOKIE_NAME]: token },
      headers: { [CSRF_HEADER_NAME]: 'b'.repeat(64) },
    } as unknown as import('express').Request;
    expect(() => assertCookieRefreshCsrf(req, prodConfig)).toThrow('Invalid CSRF token');
    const matchingReq = {
      cookies: { [REFRESH_COOKIE_NAME]: 'r', [CSRF_COOKIE_NAME]: token },
      headers: { [CSRF_HEADER_NAME]: token },
    } as unknown as import('express').Request;
    expect(() => assertCookieRefreshCsrf(matchingReq, prodConfig)).not.toThrow();
    expect(() => assertCookieRefreshCsrf(req, prodConfig, 'body-token')).not.toThrow();
  });

  it('readRefreshTokenFromRequest prefers body over cookie', () => {
    const req = {
      cookies: { [REFRESH_COOKIE_NAME]: 'from-cookie' },
    } as unknown as Request;
    expect(readRefreshTokenFromRequest(req, 'from-body')).toBe('from-body');
    expect(readRefreshTokenFromRequest(req)).toBe('from-cookie');
    expect(readRefreshTokenFromRequest({ cookies: {} } as Request)).toBeNull();
  });

  it('clearRefreshTokenCookie clears cookie', () => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
    clearRefreshTokenCookie(res, config);
    expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, expect.any(Object));
  });

  it('setSessionCookie sets httpOnly forge_session marker', () => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
    setSessionCookie(res, config);
    expect(res.cookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      '1',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
  });

  it('hasSessionCookie detects marker', () => {
    expect(
      hasSessionCookie({ cookies: { [SESSION_COOKIE_NAME]: '1' } } as unknown as Request),
    ).toBe(true);
    expect(hasSessionCookie({ cookies: {} } as unknown as Request)).toBe(false);
  });

  it('clearSessionCookie clears forge_session', () => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
    clearSessionCookie(res, config);
    expect(res.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, expect.any(Object));
  });

  it('setAccessTokenCookie sets forge_access_token as httpOnly (MED-10: server-set, not client JS)', () => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
    setAccessTokenCookie(res, 'jwt-value', config);
    expect(res.cookie).toHaveBeenCalledWith(
      ACCESS_COOKIE_NAME,
      'jwt-value',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
  });

  it('clearAccessTokenCookie clears forge_access_token', () => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
    clearAccessTokenCookie(res, config);
    expect(res.clearCookie).toHaveBeenCalledWith(ACCESS_COOKIE_NAME, expect.any(Object));
  });

  it('setAdminAuthCookies sets httpOnly forge_admin_token and forge_admin_session', () => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
    setAdminAuthCookies(res, 'admin-jwt', config);
    expect(res.cookie).toHaveBeenCalledWith(
      ADMIN_TOKEN_COOKIE_NAME,
      'admin-jwt',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE_NAME,
      '1',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('clearAdminAuthCookies clears both admin cookies', () => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
    clearAdminAuthCookies(res, config);
    expect(res.clearCookie).toHaveBeenCalledWith(ADMIN_TOKEN_COOKIE_NAME, expect.any(Object));
    expect(res.clearCookie).toHaveBeenCalledWith(ADMIN_SESSION_COOKIE_NAME, expect.any(Object));
  });
});
