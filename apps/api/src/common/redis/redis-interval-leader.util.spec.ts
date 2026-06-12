import { tryAcquireIntervalLeader } from './redis-interval-leader.util';

describe('tryAcquireIntervalLeader', () => {
  it('returns true when lock acquired', async () => {
    const redis = { set: jest.fn().mockResolvedValue('OK') } as never;
    await expect(tryAcquireIntervalLeader(redis, 'leader:test', 30)).resolves.toBe(true);
  });

  it('returns false when another replica holds the lock', async () => {
    const redis = { set: jest.fn().mockResolvedValue(null) } as never;
    await expect(tryAcquireIntervalLeader(redis, 'leader:test', 30)).resolves.toBe(false);
  });
});
