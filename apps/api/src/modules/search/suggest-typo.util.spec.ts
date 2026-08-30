import { suggestTypoPrefixes } from './suggest-typo.util';

describe('suggestTypoPrefixes', () => {
  it('returns empty for short terms', () => {
    expect(suggestTypoPrefixes('ab')).toEqual([]);
    expect(suggestTypoPrefixes('')).toEqual([]);
  });

  it('includes deletions and adjacent swaps', () => {
    const variants = suggestTypoPrefixes('forge');
    expect(variants).toContain('orge'); // drop f
    expect(variants).toContain('frge'); // drop o
    expect(variants).toContain('ofrge'); // swap f/o
    expect(variants).not.toContain('forge');
  });

  it('caps variant count', () => {
    expect(suggestTypoPrefixes('abcdefgh', 3)).toHaveLength(3);
  });
});
