import type { ConfigService } from '@nestjs/config';
import { validateProductionConfig } from './validate-production-config';

function config(overrides: Record<string, string | boolean | undefined>): ConfigService {
  const values: Record<string, string | boolean> = {
    nodeEnv: 'development',
    'jwt.secret': 'custom-jwt-secret-min-32-chars-long',
    'jwt.refreshSecret': 'custom-refresh-secret-min-32-chars',
    'mux.tokenId': 'mux-token-id',
    'mux.tokenSecret': 'mux-token-secret',
    'mux.webhookSecret': 'mux-webhook-secret',
    'mux.signingKeyId': 'signing-key-id',
    'mux.signingPrivateKey': 'signing-private-key',
    'video.transcodeProvider': 'mux',
    'stripe.enabled': false,
    ...Object.fromEntries(
      Object.entries(overrides).filter(([, v]) => v !== undefined) as [string, string | boolean][],
    ),
  };
  return {
    get: <T = string | boolean>(key: string) => values[key] as T,
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

  it('requires MUX credentials in production', () => {
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
    expect(() =>
      validateProductionConfig(
        config({
          nodeEnv: 'production',
        }),
      ),
    ).not.toThrow();
  });

  it('requires Stripe secrets when STRIPE_ENABLED in production', () => {
    expect(() =>
      validateProductionConfig(
        config({
          nodeEnv: 'production',
          'stripe.enabled': true,
          'stripe.secretKey': '',
          'stripe.webhookSecret': '',
        }),
      ),
    ).toThrow(/STRIPE_SECRET_KEY/);
  });

  it('warns when Mux signing keys are missing in production', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    validateProductionConfig(
      config({
        nodeEnv: 'production',
        'mux.signingKeyId': '',
        'mux.signingPrivateKey': '',
      }),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('MUX_SIGNING_KEY_ID'));
    warn.mockRestore();
  });
});
