import { validateProductionEnv } from './env-production.schema';

const validProdEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@host/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'custom-jwt-secret-min-32-chars-long',
  JWT_REFRESH_SECRET: 'custom-refresh-secret-min-32-chars',
  WEB_URL: 'https://forgestudios.net',
  ADMIN_URL: 'https://admin.forgestudios.net',
  MUX_TOKEN_ID: 'mux-id',
  MUX_TOKEN_SECRET: 'mux-secret',
  MUX_WEBHOOK_SECRET: 'mux-webhook',
  VIDEO_TRANSCODE_PROVIDER: 'mux',
  AWS_ACCESS_KEY_ID: 'AKIA',
  AWS_SECRET_ACCESS_KEY: 'secret',
  S3_BUCKET_NAME: 'forge-media',
  METRICS_SCRAPE_TOKEN: 'metrics-scrape-token',
  CONTENT_SCAN_ALLOW_NOOP: 'true',
};

describe('validateProductionEnv', () => {
  it('skips validation outside production', () => {
    expect(() =>
      validateProductionEnv({ NODE_ENV: 'development' }),
    ).not.toThrow();
  });

  it('passes with valid production env', () => {
    expect(() => validateProductionEnv({ ...validProdEnv })).not.toThrow();
  });

  it('requires DATABASE_URL in production', () => {
    expect(() =>
      validateProductionEnv({ ...validProdEnv, DATABASE_URL: '' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('requires REDIS_URL in production', () => {
    expect(() =>
      validateProductionEnv({ ...validProdEnv, REDIS_URL: '' }),
    ).toThrow(/REDIS_URL/);
  });

  it('requires WEB_URL and ADMIN_URL in production', () => {
    expect(() =>
      validateProductionEnv({ ...validProdEnv, WEB_URL: '' }),
    ).toThrow(/WEB_URL/);
  });

  it('rejects default JWT secrets in production', () => {
    expect(() =>
      validateProductionEnv({
        ...validProdEnv,
        JWT_SECRET: 'jwt-secret-change-in-production',
      }),
    ).toThrow(/placeholder/);
  });

  it('rejects mock subscriptions in production', () => {
    expect(() =>
      validateProductionEnv({ ...validProdEnv, MOCK_SUBSCRIPTIONS_ENABLED: 'true' }),
    ).toThrow(/MOCK_SUBSCRIPTIONS_ENABLED/);
  });

  it('rejects direct Neon URL without pooler in production', () => {
    expect(() =>
      validateProductionEnv({
        ...validProdEnv,
        DATABASE_URL:
          'postgresql://user:pass@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require',
      }),
    ).toThrow(/pooler/i);
  });

  it('accepts Neon pooled URL in production', () => {
    expect(() =>
      validateProductionEnv({
        ...validProdEnv,
        DATABASE_URL:
          'postgresql://user:pass@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require',
      }),
    ).not.toThrow();
  });

  it('allows direct Neon URL when DATABASE_ALLOW_DIRECT_NEON=true', () => {
    expect(() =>
      validateProductionEnv({
        ...validProdEnv,
        DATABASE_URL:
          'postgresql://user:pass@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require',
        DATABASE_ALLOW_DIRECT_NEON: 'true',
      }),
    ).not.toThrow();
  });

  it('requires CONTENT_SCAN_ALLOW_NOOP when scan provider is none', () => {
    expect(() =>
      validateProductionEnv({ ...validProdEnv, CONTENT_SCAN_ALLOW_NOOP: undefined }),
    ).toThrow(/CONTENT_SCAN_ALLOW_NOOP/);
  });

  it('requires webhook URL when CONTENT_SCAN_PROVIDER=webhook', () => {
    expect(() =>
      validateProductionEnv({
        ...validProdEnv,
        CONTENT_SCAN_PROVIDER: 'webhook',
        CONTENT_SCAN_WEBHOOK_URL: '',
      }),
    ).toThrow(/CONTENT_SCAN_WEBHOOK_URL/);
  });

  it('accepts webhook scan without ALLOW_NOOP', () => {
    expect(() =>
      validateProductionEnv({
        ...validProdEnv,
        CONTENT_SCAN_ALLOW_NOOP: undefined,
        CONTENT_SCAN_PROVIDER: 'webhook',
        CONTENT_SCAN_WEBHOOK_URL: 'https://scan.example.com/hook',
      }),
    ).not.toThrow();
  });
});
