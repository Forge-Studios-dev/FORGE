import { VideosService } from './videos.service';

describe('VideosService.rewritePlaybackUrl', () => {
  const svc = Object.create(VideosService.prototype) as VideosService;
  Object.assign(svc, { cdnDomain: 'https://cdn.example.com' });

  it('rewrites CDN HLS manifests', () => {
    expect(
      svc.rewritePlaybackUrl('https://d111.cloudfront.net/videos/v1/hls/master.m3u8'),
    ).toBe('https://cdn.example.com/videos/v1/hls/master.m3u8');
  });

  it('rewrites CDN thumbnail images (not only HLS)', () => {
    expect(svc.rewritePlaybackUrl('https://d111.cloudfront.net/videos/v1/thumb.jpg')).toBe(
      'https://cdn.example.com/videos/v1/thumb.jpg',
    );
  });

  it('passes through Mux image URLs', () => {
    expect(
      svc.rewritePlaybackUrl('https://image.mux.com/pb/thumbnail.jpg?width=1280'),
    ).toContain('image.mux.com');
  });
});
