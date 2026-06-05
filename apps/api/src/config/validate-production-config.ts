import type { ConfigService } from '@nestjs/config';
import { validateProductionEnv } from './env-production.schema';

const INSECURE_JWT_SECRETS = new Set([
  'jwt-secret-change-in-production',
  'jwt-refresh-secret-change-in-production',
]);

/** Validates production config at boot — uses Zod schema + legacy ConfigService checks. */
export function validateProductionConfig(config: ConfigService): void {
  const nodeEnv = config.get<string>('nodeEnv') || process.env.NODE_ENV || 'development';
  validateProductionEnv({ ...process.env, NODE_ENV: nodeEnv });

  if (nodeEnv !== 'production') return;

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
}
