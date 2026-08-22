import { slugify } from './slugify.util';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('My New Article')).toBe('my-new-article');
  });

  it('strips a trailing hyphen produced by trailing punctuation', () => {
    expect(slugify('Hello!')).toBe('hello');
  });

  it('strips a leading hyphen produced by leading punctuation', () => {
    expect(slugify('!Hello')).toBe('hello');
  });

  it('collapses repeated separators', () => {
    expect(slugify('A -- B')).toBe('a-b');
  });

  it('caps at the given max length', () => {
    expect(slugify('a'.repeat(300), 10)).toHaveLength(10);
  });

  it('defaults to a 120-character cap', () => {
    expect(slugify('a'.repeat(300))).toHaveLength(120);
  });
});
