import { AiBudgetService } from './ai-budget.service';
import type { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';

function makeService(budget: number, redis: Partial<Redis>) {
  const config = { get: jest.fn().mockReturnValue(budget) } as unknown as ConfigService;
  return new AiBudgetService(redis as Redis, config);
}

describe('AiBudgetService', () => {
  it('allows unlimited calls when budget is 0', async () => {
    const redis = { incrby: jest.fn(), expire: jest.fn(), decrby: jest.fn() };
    const service = makeService(0, redis);
    expect(await service.tryConsume()).toBe(true);
    expect(redis.incrby).not.toHaveBeenCalled();
  });

  it('sets a TTL only on the first reservation of the day', async () => {
    const redis = {
      incrby: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      decrby: jest.fn(),
    };
    const service = makeService(100, redis);
    expect(await service.tryConsume()).toBe(true);
    expect(redis.expire).toHaveBeenCalledTimes(1);
    expect(redis.expire).toHaveBeenCalledWith(expect.stringMatching(/^ai:llm:budget:/), 172800);
  });

  it('does not reset TTL on subsequent reservations', async () => {
    const redis = {
      incrby: jest.fn().mockResolvedValue(42),
      expire: jest.fn(),
      decrby: jest.fn(),
    };
    const service = makeService(100, redis);
    expect(await service.tryConsume()).toBe(true);
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('denies and rolls back the counter once the budget is exceeded', async () => {
    const redis = {
      incrby: jest.fn().mockResolvedValue(101),
      expire: jest.fn(),
      decrby: jest.fn().mockResolvedValue(100),
    };
    const service = makeService(100, redis);
    expect(await service.tryConsume()).toBe(false);
    expect(redis.decrby).toHaveBeenCalledWith(expect.stringMatching(/^ai:llm:budget:/), 1);
  });

  it('fails open when Redis errors so AI is never hard-blocked by a cache outage', async () => {
    const redis = {
      incrby: jest.fn().mockRejectedValue(new Error('max requests limit exceeded')),
      expire: jest.fn(),
      decrby: jest.fn(),
    };
    const service = makeService(100, redis);
    expect(await service.tryConsume()).toBe(true);
  });

  it('reports usage and remaining budget', async () => {
    const redis = { get: jest.fn().mockResolvedValue('30') };
    const service = makeService(100, redis);
    expect(await service.usage()).toEqual({ used: 30, budget: 100, remaining: 70 });
  });

  it('reports unlimited remaining (-1) when no budget configured', async () => {
    const redis = { get: jest.fn().mockResolvedValue(null) };
    const service = makeService(0, redis);
    expect(await service.usage()).toEqual({ used: 0, budget: 0, remaining: -1 });
  });
});
