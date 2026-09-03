import type { ConfigService } from '@nestjs/config';
import { validateProductionConfig } from './validate-production-config';

const PROD_ENV_BASE: NodeJS.ProcessEnv = {
  DATABASE_URL: 'postgresql://user:pass@host/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'custom-jwt-secret-min-32-chars-long',
  JWT_REFRESH_SECRET: 'custom-refresh-secret-min-32-chars',
  WEB_URL: 'https://forgestudios.net',
  ADMIN_URL: 'https://admin.forgestudios.net',
  MUX_TOKEN_ID: 'mux-token-id',
  MUX_TOKEN_SECRET: 'mux-token-secret',
  MUX_WEBHOOK_SECRET: 'mux-webhook-secret',
  VIDEO_TRANSCODE_PROVIDER: 'mux',
  AWS_ACCESS_KEY_ID: 'AKIA',
  AWS_SECRET_ACCESS_KEY: 'secret',
  S3_BUCKET_NAME: 'forge-media',
  METRICS_SCRAPE_TOKEN: 'metrics-scrape-token',
  CONTENT_SCAN_ALLOW_NOOP: 'true',
};

function config(overrides: Record<string, string | undefined>): ConfigService {
  const values: Record<string, string> = {
    nodeEnv: 'development',
    'jwt.secret': 'custom-jwt-secret-min-32-chars-long',
    'jwt.refreshSecret': 'custom-refresh-secret-min-32-chars',
    'mux.tokenId': 'mux-token-id',
    'mux.tokenSecret': 'mux-token-secret',
    'mux.webhookSecret': 'mux-webhook-secret',
    'video.transcodeProvider': 'mux',
    ...Object.fromEntries(
      Object.entries(overrides).filter(([, v]) => v !== undefined) as [string, string][],
    ),
  };
  return {
    get: <T = string>(key: string) => values[key] as T,
  } as ConfigService;
}

describe('validateProductionConfig', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('skips validation outside production', () => {
    expect(() =>
      validateProductionConfig(
        config({
          nodeEnv: 'development',
          'jwt.secret': 'jwt-secret-change-in-production',
        }),
      ),
    ).not.toThrow();
  });

  it('rejects default JWT secrets in production', () => {
    process.env = { ...PROD_ENV_BASE, NODE_ENV: 'production' };
    expect(() =>
      validateProductionConfig(
        config({
          nodeEnv: 'production',
          'jwt.secret': 'jwt-secret-change-in-production',
        }),
      ),
    ).toThrow(/JWT_SECRET/);
  });

  it('requires MUX credentials in production', () => {
    process.env = { ...PROD_ENV_BASE, NODE_ENV: 'production' };
    expect(() =>
      validateProductionConfig(
        config({
          nodeEnv: 'production',
          'mux.tokenId': '',
          'mux.tokenSecret': '',
          'mux.webhookSecret': '',
        }),
      ),
    ).toThrow(/MUX_TOKEN_ID and MUX_TOKEN_SECRET/);
  });

  it('requires MUX_WEBHOOK_SECRET when MUX_TOKEN_ID is set', () => {
    process.env = { ...PROD_ENV_BASE, NODE_ENV: 'production' };
    expect(() =>
      validateProductionConfig(
        config({
          nodeEnv: 'production',
          'mux.tokenId': 'mux-token-id',
          'mux.webhookSecret': '',
        }),
      ),
    ).toThrow(/MUX_WEBHOOK_SECRET/);
  });

  it('rejects non-mux transcode provider in production', () => {
    process.env = { ...PROD_ENV_BASE, NODE_ENV: 'production' };
    expect(() =>
      validateProductionConfig(
        config({
          nodeEnv: 'production',
          'video.transcodeProvider': 'ffmpeg',
        }),
      ),
    ).toThrow(/VIDEO_TRANSCODE_PROVIDER=mux/);
  });

  it('passes with strong secrets in production', () => {
    process.env = { ...PROD_ENV_BASE, NODE_ENV: 'production' };
    expect(() =>
      validateProductionConfig(
        config({
          nodeEnv: 'production',
        }),
      ),
    ).not.toThrow();
  });
});
