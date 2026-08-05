import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearSearchHistory,
  pushSearchHistory,
  readSearchHistory,
} from './search-history';

describe('search-history', () => {
  afterEach(() => {
    clearSearchHistory();
    vi.unstubAllGlobals();
  });

  it('returns empty when storage is empty', () => {
    expect(readSearchHistory()).toEqual([]);
  });

  it('stores newest first and dedupes case-insensitively', () => {
    pushSearchHistory('React');
    pushSearchHistory('Flutter');
    pushSearchHistory('react');
    expect(readSearchHistory()).toEqual(['react', 'Flutter']);
  });

  it('caps at 8 entries', () => {
    for (let i = 0; i < 12; i++) pushSearchHistory(`q${i}`);
    expect(readSearchHistory()).toHaveLength(8);
    expect(readSearchHistory()[0]).toBe('q11');
  });

  it('clear removes all', () => {
    pushSearchHistory('hello');
    clearSearchHistory();
    expect(readSearchHistory()).toEqual([]);
  });
});
