import type { ConfigService } from '@nestjs/config';
import { validateProductionConfig } from './validate-production-config';

function config(overrides: Record<string, string | undefined>): ConfigService {
  const values: Record<string, string> = {
    nodeEnv: 'development',
    'jwt.secret': 'custom-jwt-secret-min-32-chars-long',
    'jwt.refreshSecret': 'custom-refresh-secret-min-32-chars',
    'mux.webhookSecret': 'mux-webhook-secret',
    ...Object.fromEntries(
      Object.entries(overrides).filter(([, v]) => v !== undefined) as [string, string][],
    ),
  };
  return {
    get: <T = string>(key: string) => values[key] as T,
  } as ConfigService;
}

describe('validateProductionConfig', () => {
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
    expect(() =>
      validateProductionConfig(
        config({
          nodeEnv: 'production',
          'jwt.secret': 'jwt-secret-change-in-production',
        }),
      ),
    ).toThrow(/JWT_SECRET/);
  });

  it('allows missing MUX_WEBHOOK_SECRET when Mux is not configured', () => {
    expect(() =>
      validateProductionConfig(
        config({
          nodeEnv: 'production',
          'mux.tokenId': '',
          'mux.webhookSecret': '',
        }),
      ),
    ).not.toThrow();
  });

  it('requires MUX_WEBHOOK_SECRET when MUX_TOKEN_ID is set', () => {
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

  it('passes with strong secrets in production', () => {
    expect(() =>
      validateProductionConfig(
        config({
          nodeEnv: 'production',
        }),
      ),
    ).not.toThrow();
  });
});
