import { loginHrefWithNext, safeReturnPath } from './safe-return-path';

describe('safeReturnPath', () => {
  it('allows internal paths', () => {
    expect(safeReturnPath('/library')).toBe('/library');
    expect(safeReturnPath('/search?q=test')).toBe('/search?q=test');
  });

  it('blocks open redirects', () => {
    expect(safeReturnPath('//evil.com')).toBe('/');
    expect(safeReturnPath('https://evil.com')).toBe('/');
  });

  it('blocks auth loops', () => {
    expect(safeReturnPath('/login')).toBe('/');
    expect(safeReturnPath('/login?next=/library')).toBe('/');
  });
});

describe('loginHrefWithNext', () => {
  it('encodes next once', () => {
    expect(loginHrefWithNext('/library')).toBe('/login?next=%2Flibrary');
  });
});
