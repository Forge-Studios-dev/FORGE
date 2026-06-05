import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  const redis = {
    incr: jest.fn(),
    pttl: jest.fn(),
    pexpire: jest.fn(),
  };

  let storage: RedisThrottlerStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new RedisThrottlerStorage(redis as never);
  });

  it('increments and sets TTL on first hit', async () => {
    redis.incr.mockResolvedValue(1);
    redis.pttl.mockResolvedValue(-1);
    redis.pexpire.mockResolvedValue(1);

    const result = await storage.increment('ip:1.2.3.4', 60_000);

    expect(result.totalHits).toBe(1);
    expect(result.timeToExpire).toBe(60_000);
    expect(redis.pexpire).toHaveBeenCalledWith('throttle:ip:1.2.3.4', 60_000);
  });

  it('returns existing TTL on subsequent hits', async () => {
    redis.incr.mockResolvedValue(3);
    redis.pttl.mockResolvedValue(42_000);

    const result = await storage.increment('ip:1.2.3.4', 60_000);

    expect(result.totalHits).toBe(3);
    expect(result.timeToExpire).toBe(42_000);
    expect(redis.pexpire).not.toHaveBeenCalled();
  });

  it('fails open when Redis errors', async () => {
    redis.incr.mockRejectedValue(new Error('connection refused'));

    const result = await storage.increment('ip:1.2.3.4', 60_000);

    expect(result.totalHits).toBe(0);
    expect(result.timeToExpire).toBe(60_000);
  });
});
