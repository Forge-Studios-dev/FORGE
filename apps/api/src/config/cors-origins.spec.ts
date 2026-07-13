import { devCorsOrigins, productionCorsOrigins } from './cors-origins';

describe('productionCorsOrigins', () => {
  it('includes WEB_URL/ADMIN_URL plus the known forgestudios.net hosts', () => {
    const origins = productionCorsOrigins({
      WEB_URL: 'https://custom-web.example.com',
      ADMIN_URL: 'https://custom-admin.example.com',
    } as NodeJS.ProcessEnv);

    expect(origins).toEqual(
      expect.arrayContaining([
        'https://custom-web.example.com',
        'https://custom-admin.example.com',
        'https://forgestudios.net',
        'https://www.forgestudios.net',
        'https://admin.forgestudios.net',
      ]),
    );
  });

  it('dedupes and drops empty/unset values', () => {
    const origins = productionCorsOrigins({
      WEB_URL: 'https://forgestudios.net',
      ADMIN_URL: '',
    } as NodeJS.ProcessEnv);

    expect(origins.filter((o) => o === 'https://forgestudios.net')).toHaveLength(1);
    expect(origins).not.toContain('');
  });
});

describe('devCorsOrigins', () => {
  it('never returns a wildcard — always an explicit host list (LOW-01)', () => {
    const origins = devCorsOrigins({} as NodeJS.ProcessEnv);
    expect(origins).not.toContain('*');
    expect(origins.length).toBeGreaterThan(0);
  });

  it('includes the repo default dev ports for web (3000) and admin (3002)', () => {
    const origins = devCorsOrigins({} as NodeJS.ProcessEnv);
    expect(origins).toEqual(
      expect.arrayContaining(['http://localhost:3000', 'http://localhost:3002']),
    );
  });

  it('includes an explicit WEB_URL/ADMIN_URL override when set', () => {
    const origins = devCorsOrigins({
      WEB_URL: 'https://staging-web.example.com',
      ADMIN_URL: 'https://staging-admin.example.com',
    } as NodeJS.ProcessEnv);

    expect(origins).toEqual(
      expect.arrayContaining(['https://staging-web.example.com', 'https://staging-admin.example.com']),
    );
  });
});
