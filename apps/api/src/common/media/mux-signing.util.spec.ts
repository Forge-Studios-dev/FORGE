import {
  canCreateMuxSignedPlayback,
  generateTestMuxSigningConfig,
  isMuxSigningConfigured,
  muxSignedHlsPlaybackUrl,
  muxSigningConfigFrom,
  normalizeMuxPrivateKey,
  requiresMuxSignedPlayback,
  signMuxPlaybackToken,
  MUX_SIGNING_KEYS_REQUIRED,
} from './mux-signing.util';

describe('mux-signing.util', () => {
  const config = generateTestMuxSigningConfig('kid-1');

  it('isMuxSigningConfigured requires both key id and pem', () => {
    expect(isMuxSigningConfigured(null)).toBe(false);
    expect(isMuxSigningConfigured({ keyId: '', privateKeyPem: 'x' })).toBe(false);
    expect(isMuxSigningConfigured({ keyId: 'a', privateKeyPem: '' })).toBe(false);
    expect(isMuxSigningConfigured(config)).toBe(true);
  });

  it('normalizeMuxPrivateKey expands escaped newlines', () => {
    expect(normalizeMuxPrivateKey('a\\nb\\n')).toBe('a\nb\n');
    expect(normalizeMuxPrivateKey('plain')).toBe('plain');
  });

  it('requiresMuxSignedPlayback only for non-public', () => {
    expect(requiresMuxSignedPlayback('public')).toBe(false);
    expect(requiresMuxSignedPlayback('private')).toBe(true);
    expect(requiresMuxSignedPlayback('unlisted')).toBe(true);
    expect(requiresMuxSignedPlayback('subscribers')).toBe(true);
  });

  it('canCreateMuxSignedPlayback gates restricted visibility on keys', () => {
    expect(canCreateMuxSignedPlayback('public', null)).toBe(true);
    expect(canCreateMuxSignedPlayback('private', null)).toBe(false);
    expect(canCreateMuxSignedPlayback('private', config)).toBe(true);
    expect(MUX_SIGNING_KEYS_REQUIRED).toContain('MUX_SIGNING_KEY_ID');
  });

  it('muxSigningConfigFrom reads Nest-style keys', () => {
    expect(muxSigningConfigFrom(() => null)).toBeNull();
    const parsed = muxSigningConfigFrom((k) =>
      k === 'mux.signingKeyId' ? config.keyId : k === 'mux.signingPrivateKey' ? config.privateKeyPem : null,
    );
    expect(parsed?.keyId).toBe(config.keyId);
    expect(isMuxSigningConfigured(parsed)).toBe(true);
  });

  it('signMuxPlaybackToken produces three JWT segments', () => {
    const token = signMuxPlaybackToken('pb123', config, 60);
    expect(token.split('.')).toHaveLength(3);
  });

  it('muxSignedHlsPlaybackUrl appends token query', () => {
    const url = muxSignedHlsPlaybackUrl('pb123', config, 60);
    expect(url.startsWith('https://stream.mux.com/pb123.m3u8?token=')).toBe(true);
  });
});
