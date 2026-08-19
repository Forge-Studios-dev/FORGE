import { UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthOAuthExchangeService } from './auth-oauth-exchange.service';

describe('AuthOAuthExchangeService', () => {
  const redis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  };

  const config = {
    get: jest.fn((key: string) => (key === 'nodeEnv' ? 'development' : undefined)),
  };

  let service: AuthOAuthExchangeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthOAuthExchangeService(
      redis as never,
      config as unknown as ConfigService,
    );
  });

  it('creates and consumes a one-time exchange code', async () => {
    const payload = {
      accessToken: 'access.jwt',
      sessionId: 'session-1',
      user: { id: 'u1', email: 'a@b.com' },
    };
    redis.setex.mockResolvedValue('OK');
    const code = await service.createExchangeCode(payload as never);
    expect(code).toHaveLength(64);
    expect(redis.setex).toHaveBeenCalled();

    redis.get.mockResolvedValue(JSON.stringify(payload));
    redis.del.mockResolvedValue(1);
    await expect(service.consumeExchangeCode(code)).resolves.toEqual(payload);
    expect(redis.del).toHaveBeenCalled();
  });

  it('rejects reuse after consume', async () => {
    const payload = {
      accessToken: 'access.jwt',
      sessionId: 'session-1',
      user: { id: 'u1', email: 'a@b.com' },
    };
    redis.setex.mockResolvedValue('OK');
    const code = await service.createExchangeCode(payload as never);
    redis.get.mockResolvedValueOnce(JSON.stringify(payload));
    redis.del.mockResolvedValue(1);
    await service.consumeExchangeCode(code);
    redis.get.mockResolvedValueOnce(null);
    await expect(service.consumeExchangeCode(code)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects missing codes', async () => {
    redis.get.mockResolvedValue(null);
    await expect(service.consumeExchangeCode('deadcode')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('fails closed when redis SETEX errors on create', async () => {
    redis.setex.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(
      service.createExchangeCode({
        accessToken: 'a',
        sessionId: 's',
        user: { id: 'u1' },
      } as never),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('fails closed in production when redis GET errors on consume', async () => {
    (config.get as jest.Mock).mockImplementation((key: string) =>
      key === 'nodeEnv' ? 'production' : undefined,
    );
    redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(service.consumeExchangeCode('b'.repeat(64))).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  describe('payloadFromTokens', () => {
    it('omits refreshToken by default (web flow — carried in an HttpOnly cookie instead)', () => {
      const payload = service.payloadFromTokens({
        accessToken: 'access.jwt',
        sessionId: 'session-1',
        user: { id: 'u1' } as never,
      });
      expect(payload).not.toHaveProperty('refreshToken');
    });

    it('includes refreshToken when provided (mobile flow — no cookie to carry it)', () => {
      const payload = service.payloadFromTokens({
        accessToken: 'access.jwt',
        sessionId: 'session-1',
        user: { id: 'u1' } as never,
        refreshToken: 'refresh.jwt',
      });
      expect(payload.refreshToken).toBe('refresh.jwt');
    });
  });
});
