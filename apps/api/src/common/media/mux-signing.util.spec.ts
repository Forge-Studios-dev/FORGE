import { generateKeyPairSync } from 'crypto';
import { signMuxPlaybackToken, appendMuxToken } from './mux-signing.util';

describe('mux-signing.util', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

  it('signMuxPlaybackToken returns three JWT segments', () => {
    const token = signMuxPlaybackToken('pb123', 'key-id', pem, 3600);
    expect(token.split('.')).toHaveLength(3);
  });

  it('appendMuxToken adds query param', () => {
    expect(appendMuxToken('https://stream.mux.com/pb.m3u8', 'jwt')).toBe(
      'https://stream.mux.com/pb.m3u8?token=jwt',
    );
    expect(appendMuxToken('https://image.mux.com/pb/thumb.jpg?w=1', 'jwt')).toBe(
      'https://image.mux.com/pb/thumb.jpg?w=1&token=jwt',
    );
  });
});
