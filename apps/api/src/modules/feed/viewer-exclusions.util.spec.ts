import { mergeExcludedCreatorIds } from './viewer-exclusions.util';

describe('mergeExcludedCreatorIds', () => {
  it('unions muted and blocked without duplicates', () => {
    expect(mergeExcludedCreatorIds(['a', 'b'], ['b', 'c'], null, [])).toEqual(
      expect.arrayContaining(['a', 'b', 'c']),
    );
    expect(mergeExcludedCreatorIds(['a', 'b'], ['b', 'c']).length).toBe(3);
  });

  it('returns empty when nothing to exclude', () => {
    expect(mergeExcludedCreatorIds(undefined, null, [])).toEqual([]);
  });
});
