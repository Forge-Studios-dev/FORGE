import {
  isMuxImageThumbnailHost,
  muxPlaybackIdFromHlsUrl,
  muxPlaybackIdFromImageUrl,
  muxThumbnailUrl,
  resolveStreamThumbnailUrl,
} from './mux-playback.util';

describe('mux-playback.util', () => {
  it('extracts playback id from Mux HLS URL', () => {
    expect(muxPlaybackIdFromHlsUrl('https://stream.mux.com/abc123.m3u8')).toBe('abc123');
  });

  it('builds Mux thumbnail URL', () => {
    expect(muxThumbnailUrl('pb1')).toContain('image.mux.com/pb1');
  });

  it('resolves thumbnail from playback when stored thumbnail is missing', () => {
    const url = resolveStreamThumbnailUrl({
      thumbnailUrl: null,
      playbackUrl: 'https://stream.mux.com/livepb.m3u8',
    });
    expect(url).toContain('image.mux.com/livepb');
  });

  it('isMuxImageThumbnailHost rejects substring host bypass', () => {
    expect(isMuxImageThumbnailHost('https://image.mux.com/pb1/thumbnail.jpg')).toBe(true);
    expect(isMuxImageThumbnailHost('https://evil-image.mux.com.attacker/pb1')).toBe(false);
  });

  it('muxPlaybackIdFromImageUrl parses playback id from pathname', () => {
    expect(
      muxPlaybackIdFromImageUrl('https://image.mux.com/pb1/thumbnail.jpg?width=1280'),
    ).toBe('pb1');
  });

  it('prefers stored thumbnail over Mux derivation', () => {
    const url = resolveStreamThumbnailUrl({
      thumbnailUrl: 'https://cdn.example.com/poster.jpg',
      playbackUrl: 'https://stream.mux.com/livepb.m3u8',
    });
    expect(url).toBe('https://cdn.example.com/poster.jpg');
  });
});
