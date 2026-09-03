import { WebhookIdempotencyService } from './webhook-idempotency.service';

describe('WebhookIdempotencyService', () => {
  const repo = {
    findOne: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    save: jest.fn(),
    create: jest.fn((row) => row),
  };
  const redis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  };

  let service: WebhookIdempotencyService;

  beforeEach(() => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');
    redis.del.mockResolvedValue(1);
    repo.findOne.mockResolvedValue(null);
    repo.insert.mockResolvedValue(undefined);
    repo.delete.mockResolvedValue({ affected: 1 });
    service = new WebhookIdempotencyService(repo as never, redis as never);
  });

  it('tryAcquire inserts once and rejects duplicates via unique violation', async () => {
    expect(await service.tryAcquire('stripe', 'evt_1', 'checkout')).toBe(true);
    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'stripe', eventId: 'evt_1', eventType: 'checkout' }),
    );

    repo.insert.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));
    expect(await service.tryAcquire('stripe', 'evt_1')).toBe(false);
  });

  it('tryAcquire short-circuits on Redis cache hit', async () => {
    redis.get.mockResolvedValueOnce('1');
    expect(await service.tryAcquire('mux', 'evt_2')).toBe(false);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('release deletes DB row and Redis key so retries can reacquire', async () => {
    await service.release('stripe', 'evt_1');
    expect(repo.delete).toHaveBeenCalledWith({ provider: 'stripe', eventId: 'evt_1' });
    expect(redis.del).toHaveBeenCalledWith('webhook:processed:stripe:evt_1');
  });
});
