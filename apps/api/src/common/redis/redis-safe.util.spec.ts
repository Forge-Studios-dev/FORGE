import { isRedisQuotaError } from './redis-safe.util';

describe('isRedisQuotaError', () => {
  it('detects Upstash quota message', () => {
    expect(
      isRedisQuotaError(new Error('ERR max requests limit exceeded. Limit: 500000')),
    ).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isRedisQuotaError(new Error('ECONNREFUSED'))).toBe(false);
  });
});
