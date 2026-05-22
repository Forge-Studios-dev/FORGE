import type { ConfigService } from '@nestjs/config';

const INSECURE_JWT_SECRETS = new Set([
  'jwt-secret-change-in-production',
  'jwt-refresh-secret-change-in-production',
]);

export function validateProductionConfig(config: ConfigService): void {
  if (config.get<string>('nodeEnv') !== 'production') return;

  const jwtSecret = config.get<string>('jwt.secret') || '';
  const refreshSecret = config.get<string>('jwt.refreshSecret') || '';
  if (INSECURE_JWT_SECRETS.has(jwtSecret) || INSECURE_JWT_SECRETS.has(refreshSecret)) {
    throw new Error(
      'Production requires JWT_SECRET and JWT_REFRESH_SECRET — do not use default placeholder values.',
    );
  }

  const muxWebhookSecret = config.get<string>('mux.webhookSecret') || '';
  if (!muxWebhookSecret.trim()) {
    throw new Error('Production requires MUX_WEBHOOK_SECRET for Mux webhook signature verification.');
  }
}
