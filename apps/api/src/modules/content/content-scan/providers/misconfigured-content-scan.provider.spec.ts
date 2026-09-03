import { MisconfiguredContentScanProvider } from './misconfigured-content-scan.provider';

describe('MisconfiguredContentScanProvider', () => {
  it('always holds with scan_misconfigured', async () => {
    const p = new MisconfiguredContentScanProvider();
    await expect(
      p.scan({
        videoId: 'v1',
        userId: 'u1',
        hlsUrl: null,
        thumbnailUrl: null,
      }),
    ).resolves.toEqual({
      action: 'hold',
      categories: ['scan_misconfigured'],
      provider: 'misconfigured',
    });
  });
});
