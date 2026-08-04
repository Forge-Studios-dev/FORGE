import {
  generateTestMuxSigningConfig,
  isMuxSigningConfigured,
  muxSignedHlsPlaybackUrl,
  normalizeMuxPrivateKey,
  requiresMuxSignedPlayback,
  signMuxPlaybackToken,
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

  it('signMuxPlaybackToken produces three JWT segments', () => {
    const token = signMuxPlaybackToken('pb123', config, 60);
    expect(token.split('.')).toHaveLength(3);
  });

  it('muxSignedHlsPlaybackUrl appends token query', () => {
    const url = muxSignedHlsPlaybackUrl('pb123', config, 60);
    expect(url.startsWith('https://stream.mux.com/pb123.m3u8?token=')).toBe(true);
  });
});
