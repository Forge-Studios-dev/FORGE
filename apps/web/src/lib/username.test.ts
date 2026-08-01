import { describe, expect, it } from 'vitest';
import { isValidProfileUsername } from './username';

describe('isValidProfileUsername', () => {
  it('accepts signup-shaped usernames', () => {
    expect(isValidProfileUsername('john_doe')).toBe(true);
    expect(isValidProfileUsername('abc')).toBe(true);
    expect(isValidProfileUsername('A'.repeat(30))).toBe(true);
  });

  it('rejects static / reserved path junk that hits [username]', () => {
    expect(isValidProfileUsername('favicon.ico')).toBe(false);
    expect(isValidProfileUsername('robots.txt')).toBe(false);
    expect(isValidProfileUsername('apple-touch-icon.png')).toBe(false);
    expect(isValidProfileUsername('ab')).toBe(false);
    expect(isValidProfileUsername('')).toBe(false);
    expect(isValidProfileUsername(null)).toBe(false);
  });
});
