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

  const muxTokenId = config.get<string>('mux.tokenId') || '';
  const muxTokenSecret = config.get<string>('mux.tokenSecret') || '';
  const muxWebhookSecret = config.get<string>('mux.webhookSecret') || '';
  if (muxTokenId.trim() && !muxWebhookSecret.trim()) {
    throw new Error(
      'MUX_WEBHOOK_SECRET is required when MUX_TOKEN_ID is set (Mux webhooks).',
    );
  }

  const transcodeProvider = (config.get<string>('video.transcodeProvider') || 'mux').toLowerCase();
  if (transcodeProvider !== 'mux') {
    throw new Error(
      'Production requires VIDEO_TRANSCODE_PROVIDER=mux (FFmpeg transcode is for local dev only).',
    );
  }
  if (!muxTokenId.trim() || !muxTokenSecret.trim()) {
    throw new Error(
      'Production requires MUX_TOKEN_ID and MUX_TOKEN_SECRET on Fly secrets.',
    );
  }
  if (!muxWebhookSecret.trim()) {
    throw new Error(
      'Production requires MUX_WEBHOOK_SECRET for video.asset.ready / errored webhooks.',
    );
  }

  const signingKeyId = config.get<string>('mux.signingKeyId') || '';
  const signingPrivateKey = config.get<string>('mux.signingPrivateKey') || '';
  if (!signingKeyId.trim() || !signingPrivateKey.trim()) {
    console.warn(
      '[FORGE] MUX_SIGNING_KEY_ID / MUX_SIGNING_PRIVATE_KEY not set — gated playback URLs will be unsigned.',
    );
  }

  if (config.get<boolean>('stripe.enabled') === true) {
    const stripeSecret = config.get<string>('stripe.secretKey') || '';
    const stripeWebhook = config.get<string>('stripe.webhookSecret') || '';
    if (!stripeSecret.trim() || !stripeWebhook.trim()) {
      throw new Error(
        'STRIPE_ENABLED=true requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET on Fly secrets.',
      );
    }
  }
}
