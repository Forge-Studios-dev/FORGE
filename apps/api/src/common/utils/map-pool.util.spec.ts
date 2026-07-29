import { mapPool } from './map-pool.util';

describe('mapPool', () => {
  it('runs all items with capped concurrency', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const order: number[] = [];

    await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      order.push(n);
      inFlight -= 1;
    });

    expect(order.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it('no-ops on empty input', async () => {
    const fn = jest.fn();
    await mapPool([], 3, fn);
    expect(fn).not.toHaveBeenCalled();
  });
});
