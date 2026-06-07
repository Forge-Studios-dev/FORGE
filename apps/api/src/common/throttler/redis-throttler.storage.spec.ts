import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  it('fail-open when redis errors', async () => {
    const redis = {
      multi: jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        pttl: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      }),
      pexpire: jest.fn(),
    };
    const storage = new RedisThrottlerStorage(redis as never);
    await expect(storage.increment('throttle:key', 60_000)).resolves.toEqual({
      totalHits: 0,
      timeToExpire: 60_000,
    });
  });
});
