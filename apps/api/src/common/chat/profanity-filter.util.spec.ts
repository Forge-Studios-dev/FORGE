import { maskProfanity } from './profanity-filter.util';

describe('maskProfanity', () => {
  it('masks blocklisted words', () => {
    expect(maskProfanity('what the fuck', true)).toBe('what the ****');
  });

  it('returns original when disabled', () => {
    expect(maskProfanity('what the fuck', false)).toBe('what the fuck');
  });
});
