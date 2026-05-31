import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthAccountLockoutService } from './auth-account-lockout.service';

describe('AuthAccountLockoutService', () => {
  const redis = {
    get: jest.fn(),
    incr: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'auth.lockout.maxAttempts') return 3;
      if (key === 'auth.lockout.windowSec') return 900;
      if (key === 'auth.lockout.lockoutSec') return 60;
      return undefined;
    }),
  };

  let service: AuthAccountLockoutService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthAccountLockoutService(redis as never, config as unknown as ConfigService);
  });

  it('throws when account is locked', async () => {
    redis.get.mockResolvedValue('1');
    await expect(service.assertNotLocked('user@example.com')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('locks after max failed attempts', async () => {
    redis.incr.mockResolvedValue(3);
    await service.recordFailedLogin('user@example.com', '127.0.0.1');
    expect(redis.setex).toHaveBeenCalledWith('auth:lock:user@example.com', 60, '1');
  });
});
