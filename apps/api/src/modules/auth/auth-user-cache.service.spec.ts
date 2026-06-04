import { AuthUserCacheService } from './auth-user-cache.service';
import { UserRole, CreatorStatus } from '../users/entities/user.entity';

describe('AuthUserCacheService', () => {
  const redis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  };

  let service: AuthUserCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthUserCacheService(redis as never);
  });

  it('returns null on cache miss', async () => {
    redis.get.mockResolvedValue(null);
    await expect(service.get('u1')).resolves.toBeNull();
  });

  it('round-trips cached user', async () => {
    const user = {
      id: 'u1',
      email: 'a@b.c',
      role: UserRole.USER,
      creatorStatus: null,
      isVerified: true,
      isActive: true,
      deletedAt: null,
    };
    redis.get.mockResolvedValue(JSON.stringify(user));
    await expect(service.get('u1')).resolves.toEqual(user);
  });

  it('bust deletes key', async () => {
    await service.bust('u1');
    expect(redis.del).toHaveBeenCalledWith('auth:user:u1');
  });
});
