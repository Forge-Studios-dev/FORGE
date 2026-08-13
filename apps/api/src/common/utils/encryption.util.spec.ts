import { randomBytes } from 'crypto';
import { decryptWithKey, encryptWithKey } from './encryption.util';

describe('encryption.util', () => {
  const key = randomBytes(32).toString('base64');

  it('round-trips plaintext through encrypt/decrypt', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptWithKey(plaintext, key);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptWithKey(encrypted, key)).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const plaintext = 'same-secret';
    expect(encryptWithKey(plaintext, key)).not.toBe(encryptWithKey(plaintext, key));
  });

  it('throws when the key is missing', () => {
    expect(() => encryptWithKey('x', undefined)).toThrow('Encryption key is not configured');
  });

  it('throws when the key is not 32 bytes', () => {
    const shortKey = Buffer.from('too-short').toString('base64');
    expect(() => encryptWithKey('x', shortKey)).toThrow('32 bytes');
  });

  it('throws on tampered ciphertext (auth tag mismatch)', () => {
    const encrypted = encryptWithKey('secret', key);
    const [iv, authTag] = encrypted.split('.');
    const tampered = [iv, authTag, Buffer.from('tampered-data').toString('base64')].join('.');
    expect(() => decryptWithKey(tampered, key)).toThrow();
  });

  it('fails to decrypt with the wrong key', () => {
    const encrypted = encryptWithKey('secret', key);
    const otherKey = randomBytes(32).toString('base64');
    expect(() => decryptWithKey(encrypted, otherKey)).toThrow();
  });
});
