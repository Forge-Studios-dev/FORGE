import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthSessionCacheService } from './auth-session-cache.service';
import { RefreshToken } from './entities/refresh-token.entity';

describe('AuthSessionCacheService', () => {
  let service: AuthSessionCacheService;
  const redisStore = new Map<string, string>();

  const redisMock = {
    get: jest.fn(async (key: string) => redisStore.get(key) ?? null),
    setex: jest.fn(async (key: string, _ttl: number, value: string) => {
      redisStore.set(key, value);
    }),
    del: jest.fn(async (...keys: string[]) => {
      for (const key of keys) redisStore.delete(key);
    }),
  };

  const refreshRepoMock = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    redisStore.clear();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthSessionCacheService,
        { provide: 'default_IORedisModuleConnectionToken', useValue: redisMock },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshRepoMock },
      ],
    }).compile();

    service = module.get(AuthSessionCacheService);
  });

  it('marks session active and validates from cache', async () => {
    await service.markActive('sid-1', 'user-1');
    await expect(service.assertSessionActive('sid-1', 'user-1')).resolves.toBe(true);
    expect(refreshRepoMock.findOne).not.toHaveBeenCalled();
  });

  it('rejects revoked sessions', async () => {
    await service.markRevoked('sid-2');
    await expect(service.assertSessionActive('sid-2', 'user-1')).resolves.toBe(false);
  });

  it('falls back to DB when cache miss', async () => {
    refreshRepoMock.findOne.mockResolvedValue({
      id: 'sid-3',
      expiresAt: new Date(Date.now() + 3600_000),
    });
    await expect(service.assertSessionActive('sid-3', 'user-1')).resolves.toBe(true);
  });
});
