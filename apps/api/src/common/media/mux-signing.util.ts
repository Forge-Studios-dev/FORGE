import { createSign } from 'crypto';

function base64UrlJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * Mux signed playback JWT (RS256).
 * @see https://docs.mux.com/guides/secure-video-playback
 */
export function signMuxPlaybackToken(
  playbackId: string,
  signingKeyId: string,
  privateKeyPem: string,
  expirationSec: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: signingKeyId };
  const payload = {
    sub: playbackId,
    aud: 'v',
    exp: now + expirationSec,
    kid: signingKeyId,
  };

  const encodedHeader = base64UrlJson(header);
  const encodedPayload = base64UrlJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const pem = privateKeyPem.includes('\\n')
    ? privateKeyPem.replace(/\\n/g, '\n')
    : privateKeyPem;

  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  sign.end();
  const signature = sign.sign(pem, 'base64url');

  return `${signingInput}.${signature}`;
}

/** Append Mux playback token query param to HLS or thumbnail URL. */
export function appendMuxToken(url: string, token: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${token}`;
}
