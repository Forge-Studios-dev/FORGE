import { createSign, generateKeyPairSync } from 'crypto';

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

/** Non-public Mux assets should use signed playback when keys are configured. */
export function requiresMuxSignedPlayback(visibility: string): boolean {
  return visibility !== 'public';
}

/** Shared operator-facing message when signed Mux policy is required but keys are missing. */
export const MUX_SIGNING_KEYS_REQUIRED =
  'Private and members-only Mux playback requires signing keys (MUX_SIGNING_KEY_ID + MUX_SIGNING_PRIVATE_KEY). See MEDIA.md.';

/**
 * Build signing config from Nest `ConfigService`-style getters.
 * Returns null when either key is blank.
 */
export function muxSigningConfigFrom(
  get: (key: string) => string | undefined | null,
): MuxSigningConfig | null {
  const keyId = (get('mux.signingKeyId') || '').trim();
  const rawKey = (get('mux.signingPrivateKey') || '').trim();
  if (!keyId || !rawKey) return null;
  return { keyId, privateKeyPem: normalizeMuxPrivateKey(rawKey) };
}

/**
 * True when this visibility can be ingested/served safely with the given keys.
 * Public never needs keys; restricted visibility needs both key id + PEM.
 */
export function canCreateMuxSignedPlayback(
  visibility: string,
  config: MuxSigningConfig | null,
): boolean {
  if (!requiresMuxSignedPlayback(visibility)) return true;
  return isMuxSigningConfigured(config);
}

/** Test helper — generates an ephemeral RSA key pair for unit tests. */
export function generateTestMuxSigningConfig(keyId = 'test-key'): MuxSigningConfig {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return { keyId, privateKeyPem: privateKey };
}
