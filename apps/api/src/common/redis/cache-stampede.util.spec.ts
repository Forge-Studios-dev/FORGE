import { jitterTtl, singleFlight } from './cache-stampede.util';

describe('singleFlight', () => {
  it('shares one in-flight call across concurrent callers with the same key', async () => {
    let calls = 0;
    const fn = () =>
      new Promise<number>((resolve) => {
        calls++;
        setTimeout(() => resolve(42), 10);
      });

    const [a, b, c] = await Promise.all([
      singleFlight('k1', fn),
      singleFlight('k1', fn),
      singleFlight('k1', fn),
    ]);

    expect(calls).toBe(1);
    expect([a, b, c]).toEqual([42, 42, 42]);
  });

  it('runs a fresh call once the previous one has settled', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return calls;
    };

    const first = await singleFlight('k2', fn);
    const second = await singleFlight('k2', fn);

    expect(first).toBe(1);
    expect(second).toBe(2);
  });

  it('does not coalesce calls under different keys', async () => {
    let calls = 0;
    const fn = () => {
      const callNumber = ++calls;
      return new Promise<number>((resolve) => setTimeout(() => resolve(callNumber), 5));
    };

    const [a, b] = await Promise.all([singleFlight('k3a', fn), singleFlight('k3b', fn)]);

    expect(calls).toBe(2);
    expect(a).not.toBe(b);
  });

  it('propagates rejection to all coalesced callers and clears the entry', async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      return Promise.reject(new Error('boom'));
    };

    await expect(
      Promise.all([singleFlight('k4', fn), singleFlight('k4', fn)]),
    ).rejects.toThrow('boom');
    expect(calls).toBe(1);

    // Entry cleared after settling — a later call runs fn again, not the stale rejection.
    await expect(singleFlight('k4', async () => 'ok')).resolves.toBe('ok');
  });
});

describe('jitterTtl', () => {
  it('stays within ±jitterRatio of the base TTL', () => {
    for (let i = 0; i < 200; i++) {
      const result = jitterTtl(100, 0.15);
      expect(result).toBeGreaterThanOrEqual(85);
      expect(result).toBeLessThanOrEqual(115);
    }
  });

  it('never returns less than 1 even for a tiny base TTL', () => {
    for (let i = 0; i < 50; i++) {
      expect(jitterTtl(1, 0.5)).toBeGreaterThanOrEqual(1);
    }
  });

  it('produces varying values across calls (not a constant)', () => {
    const values = new Set(Array.from({ length: 20 }, () => jitterTtl(1000)));
    expect(values.size).toBeGreaterThan(1);
  });
});
