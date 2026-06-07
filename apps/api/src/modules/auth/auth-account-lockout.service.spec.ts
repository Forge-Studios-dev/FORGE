import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
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
    get: jest.fn(),
  };

  let service: AuthAccountLockoutService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) => {
      if (key === 'nodeEnv') return 'development';
      if (key === 'auth.lockout.maxAttempts') return 3;
      if (key === 'auth.lockout.windowSec') return 900;
      if (key === 'auth.lockout.lockoutSec') return 60;
      return undefined;
    });
    service = new AuthAccountLockoutService(redis as never, config as unknown as ConfigService);
  });

  it('throws when account is locked', async () => {
    redis.get.mockResolvedValue('1');
    await expect(service.assertNotLocked('user@example.com')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('allows login when lock key is missing in production', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'nodeEnv') return 'production';
      if (key === 'auth.lockout.maxAttempts') return 3;
      if (key === 'auth.lockout.windowSec') return 900;
      if (key === 'auth.lockout.lockoutSec') return 60;
      return undefined;
    });
    redis.get.mockResolvedValue(null);
    await expect(service.assertNotLocked('user@example.com')).resolves.toBeUndefined();
  });

  it('fails closed in production when redis GET errors', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'nodeEnv') return 'production';
      return undefined;
    });
    redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(service.assertNotLocked('user@example.com')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('locks after max failed attempts on email-global counter', async () => {
    redis.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(3);
    await service.recordFailedLogin('user@example.com', '127.0.0.1');
    expect(redis.setex).toHaveBeenCalledWith('auth:lock:user@example.com', 60, '1');
    expect(redis.del).toHaveBeenCalledWith('auth:fail:user@example.com:127.0.0.1');
    expect(redis.del).toHaveBeenCalledWith('auth:fail:user@example.com');
  });

  it('locks when email-global counter reaches max even from a new IP', async () => {
    redis.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(3);
    await service.recordFailedLogin('user@example.com', '10.0.0.99');
    expect(redis.setex).toHaveBeenCalledWith('auth:lock:user@example.com', 60, '1');
  });

  it('clears email-global failure counter on success', async () => {
    await service.clearFailures('User@Example.com', '127.0.0.1');
    expect(redis.del).toHaveBeenCalledWith('auth:fail:user@example.com:127.0.0.1');
    expect(redis.del).toHaveBeenCalledWith('auth:fail:user@example.com');
    expect(redis.del).toHaveBeenCalledWith('auth:lock:user@example.com');
  });
});
