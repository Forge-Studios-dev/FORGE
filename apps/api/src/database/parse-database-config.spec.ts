import { databaseNameFromUrl, parseDatabaseConfig } from './parse-database-config';

describe('databaseNameFromUrl', () => {
  it('parses neon pooled urls', () => {
    expect(
      databaseNameFromUrl(
        'postgresql://user:pass@ep-x-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
      ),
    ).toBe('neondb');
  });

  it('decodes encoded path segments', () => {
    expect(databaseNameFromUrl('postgres://u:p@localhost:5432/my%2Ddb')).toBe('my-db');
  });
});

describe('parseDatabaseConfig', () => {
  it('sets database alongside DATABASE_URL for TypeORM metadata', () => {
    const cfg = parseDatabaseConfig({
      DATABASE_URL: 'postgresql://u:p@ep-x-pooler.us-east-1.aws.neon.tech/forge_prod?sslmode=require',
      NODE_ENV: 'production',
    });
    expect(cfg.url).toContain('neon.tech');
    expect(cfg.database).toBe('forge_prod');
  });
});
