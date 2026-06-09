import { createSign } from 'crypto';

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export type MuxSigningConfig = {
  keyId: string;
  privateKeyPem: string;
};

/** Normalize MUX_PRIVATE_KEY env (escaped newlines). */
export function normalizeMuxPrivateKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes('\\n')) {
    return trimmed.replace(/\\n/g, '\n');
  }
  return trimmed;
}

export function isMuxSigningConfigured(config: MuxSigningConfig | null): config is MuxSigningConfig {
  return !!(config?.keyId?.trim() && config?.privateKeyPem?.trim());
}

/**
 * Mux signed playback JWT (RS256).
 * @see https://docs.mux.com/guides/secure-video-playback
 */
export function signMuxPlaybackToken(
  playbackId: string,
  config: MuxSigningConfig,
  expiresSec = 3600,
): string {
  const header = { alg: 'RS256', typ: 'JWT', kid: config.keyId };
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: playbackId, aud: 'v', exp: now + expiresSec };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  sign.end();
  const signature = sign.sign(config.privateKeyPem);
  return `${signingInput}.${base64url(signature)}`;
}

export function muxSignedHlsPlaybackUrl(
  playbackId: string,
  config: MuxSigningConfig,
  expiresSec = 3600,
): string {
  const token = signMuxPlaybackToken(playbackId, config, expiresSec);
  return `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;
}
