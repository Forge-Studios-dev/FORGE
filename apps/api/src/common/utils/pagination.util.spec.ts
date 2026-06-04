import { clampLimit, clampPage, MAX_LIST_LIMIT } from './pagination.util';

describe('pagination.util', () => {
  it('clamps limit to max', () => {
    expect(clampLimit(999)).toBe(MAX_LIST_LIMIT);
    expect(clampLimit(10)).toBe(10);
    expect(clampLimit(undefined)).toBe(20);
  });

  it('clamps invalid page to 1', () => {
    expect(clampPage(0)).toBe(1);
    expect(clampPage('3')).toBe(3);
  });
});
