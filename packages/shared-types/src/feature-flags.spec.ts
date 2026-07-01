import { parseFeatureFlags, isFeatureEnabled } from './feature-flags';

describe('parseFeatureFlags', () => {
  it('returns empty array for empty/null input', () => {
    expect(parseFeatureFlags(undefined)).toEqual([]);
    expect(parseFeatureFlags(null)).toEqual([]);
    expect(parseFeatureFlags('')).toEqual([]);
    expect(parseFeatureFlags('   ')).toEqual([]);
  });

  it('parses comma-separated flags', () => {
    expect(parseFeatureFlags('feature_a,feature_b')).toEqual(['feature_a', 'feature_b']);
  });

  it('trims whitespace and lowercases', () => {
    expect(parseFeatureFlags('  FEATURE_A , FeatureB  ')).toEqual(['feature_a', 'featureb']);
  });

  it('deduplicates flags', () => {
    expect(parseFeatureFlags('flag_a,flag_a,flag_b')).toEqual(['flag_a', 'flag_b']);
  });

  it('filters invalid flag names', () => {
    expect(parseFeatureFlags('valid_flag,123invalid,another-invalid,ok')).toEqual([
      'valid_flag',
      'ok',
    ]);
  });

  it('handles single flag', () => {
    expect(parseFeatureFlags('my_flag')).toEqual(['my_flag']);
  });
});

describe('isFeatureEnabled', () => {
  const flags = ['feature_a', 'feature_b'];

  it('returns true for enabled flag', () => {
    expect(isFeatureEnabled(flags, 'feature_a')).toBe(true);
  });

  it('returns false for disabled flag', () => {
    expect(isFeatureEnabled(flags, 'feature_c')).toBe(false);
  });

  it('trims and lowercases the name', () => {
    expect(isFeatureEnabled(flags, '  FEATURE_A  ')).toBe(true);
  });

  it('returns false for empty flags array', () => {
    expect(isFeatureEnabled([], 'feature_a')).toBe(false);
  });
});
