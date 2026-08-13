import { NoopContentScanProvider } from './noop-content-scan.provider';

describe('NoopContentScanProvider', () => {
  it('always approves', async () => {
    const provider = new NoopContentScanProvider();
    const verdict = await provider.scan({
      videoId: 'video-1',
      userId: 'user-1',
      hlsUrl: 'https://example.com/hls.m3u8',
      thumbnailUrl: 'https://example.com/thumb.jpg',
    });
    expect(verdict).toEqual({ action: 'approve', categories: [], provider: 'noop' });
  });
});
