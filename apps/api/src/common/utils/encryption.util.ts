import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;

function loadKey(rawKey: string | undefined): Buffer {
  if (!rawKey) {
    throw new Error('Encryption key is not configured');
  }
  const key = Buffer.from(rawKey, 'base64');
  if (key.length !== 32) {
    throw new Error('Encryption key must decode (base64) to exactly 32 bytes');
  }
  return key;
}

/** AES-256-GCM encrypt. Output: base64(iv).base64(authTag).base64(ciphertext) — safe to store as a single text column. */
export function encryptWithKey(plaintext: string, rawKey: string | undefined): string {
  const key = loadKey(rawKey);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    '.',
  );
}

export function decryptWithKey(payload: string, rawKey: string | undefined): string {
  const key = loadKey(rawKey);
  const [ivB64, authTagB64, dataB64] = payload.split('.');
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error('Malformed encrypted payload');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
