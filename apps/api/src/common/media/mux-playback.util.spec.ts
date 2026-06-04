import {
  muxPlaybackIdFromHlsUrl,
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

  it('prefers stored thumbnail over Mux derivation', () => {
    const url = resolveStreamThumbnailUrl({
      thumbnailUrl: 'https://cdn.example.com/poster.jpg',
      playbackUrl: 'https://stream.mux.com/livepb.m3u8',
    });
    expect(url).toBe('https://cdn.example.com/poster.jpg');
  });
});
