import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import {
  REFRESH_COOKIE_NAME,
  readRefreshTokenFromRequest,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from './auth-cookies';

describe('auth-cookies', () => {
  const config = {
    get: (key: string) => {
      if (key === 'nodeEnv') return 'development';
      if (key === 'auth.refreshCookieDomain') return '';
      return undefined;
    },
  } as unknown as ConfigService;

  it('setRefreshTokenCookie sets httpOnly forge_refresh', () => {
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
});
