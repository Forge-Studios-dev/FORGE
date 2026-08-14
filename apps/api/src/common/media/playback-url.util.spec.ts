import {
  isAllowedCaptionUrl,
  isAllowedHlsUrl,
  isAllowedThumbnailUrl,
  sanitizeCaptionUrl,
  sanitizeHlsUrl,
  sanitizeThumbnailUrl,
} from './playback-url.util';

describe('playback-url.util', () => {
  it('allows Mux HLS', () => {
    expect(isAllowedHlsUrl('https://stream.mux.com/pb1.m3u8')).toBe(true);
  });

  it('rejects S3 originals and bare MP4 for HLS', () => {
    expect(
      isAllowedHlsUrl('https://bucket.s3.amazonaws.com/videos/u/v/original.mp4'),
    ).toBe(false);
    expect(isAllowedHlsUrl('https://cdn.example.com/foo.mp4')).toBe(false);
  });

  it('allows CDN HLS masters', () => {
    expect(isAllowedHlsUrl('https://d123.cloudfront.net/videos/v1/hls/master.m3u8')).toBe(true);
  });

  it('allows Mux and CDN thumbnails', () => {
    expect(isAllowedThumbnailUrl('https://image.mux.com/pb/thumbnail.jpg')).toBe(true);
    expect(isAllowedThumbnailUrl('https://d123.cloudfront.net/thumb.webp')).toBe(true);
    expect(isAllowedThumbnailUrl('https://x/original.mp4')).toBe(false);
  });

  it('allows Mux and CDN WebVTT captions', () => {
    expect(isAllowedCaptionUrl('https://stream.mux.com/pb1/text/track-1.vtt')).toBe(true);
    expect(isAllowedCaptionUrl('https://d123.cloudfront.net/videos/v1/captions/en.vtt')).toBe(
      true,
    );
    expect(isAllowedCaptionUrl('https://stream.mux.com/pb1.m3u8')).toBe(false);
    expect(sanitizeCaptionUrl('https://cdn.example/en.vtt')).toContain('.vtt');
    expect(sanitizeCaptionUrl('https://x/original.mp4')).toBeNull();
  });

  it('sanitize strips unsafe HLS URLs', () => {
    expect(sanitizeHlsUrl('https://stream.mux.com/pb.m3u8')).toBe(
      'https://stream.mux.com/pb.m3u8',
    );
    expect(sanitizeHlsUrl('https://x/original.mp4')).toBeNull();
    expect(sanitizeThumbnailUrl('https://image.mux.com/pb/thumbnail.jpg')).toContain('mux.com');
  });
});
