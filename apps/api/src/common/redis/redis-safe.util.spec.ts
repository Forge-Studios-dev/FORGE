import { isRedisQuotaError, safeRedisGet, safeRedisGetResult } from './redis-safe.util';

describe('safeRedisGetResult', () => {
  it('returns ok with null when key is missing', async () => {
    const redis = { get: jest.fn().mockResolvedValue(null) };
    await expect(safeRedisGetResult(redis as never, 'k')).resolves.toEqual({
      ok: true,
      value: null,
    });
  });

  it('returns ok with value when key exists', async () => {
    const redis = { get: jest.fn().mockResolvedValue('1') };
    await expect(safeRedisGetResult(redis as never, 'k')).resolves.toEqual({
      ok: true,
      value: '1',
    });
  });

  it('returns not ok when redis throws', async () => {
    const redis = { get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    await expect(safeRedisGetResult(redis as never, 'k')).resolves.toEqual({ ok: false });
  });

  it('safeRedisGet returns null for both missing key and error', async () => {
    const missing = { get: jest.fn().mockResolvedValue(null) };
    await expect(safeRedisGet(missing as never, 'k')).resolves.toBeNull();

    const error = { get: jest.fn().mockRejectedValue(new Error('down')) };
    await expect(safeRedisGet(error as never, 'k')).resolves.toBeNull();
  });
});

describe('isRedisQuotaError', () => {
  it('detects Redis quota message', () => {
    expect(
      isRedisQuotaError(new Error('ERR max requests limit exceeded. Limit: 500000')),
    ).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isRedisQuotaError(new Error('ECONNREFUSED'))).toBe(false);
  });
});
