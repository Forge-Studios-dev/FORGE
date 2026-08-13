import { ContentScanService } from './content-scan.service';
import { NoopContentScanProvider } from './providers/noop-content-scan.provider';
import { WebhookContentScanProvider } from './providers/webhook-content-scan.provider';

const input = {
  videoId: 'video-1',
  userId: 'user-1',
  hlsUrl: 'https://example.com/hls.m3u8',
  thumbnailUrl: 'https://example.com/thumb.jpg',
};

function makeConfig(map: Record<string, string | number>) {
  return { get: (key: string) => map[key] };
}

describe('ContentScanService', () => {
  it('defaults to the noop provider when unconfigured', async () => {
    const service = new ContentScanService(makeConfig({}) as never);

    expect(service.isEnabled()).toBe(false);
    await expect(service.scanVideo(input)).resolves.toEqual({
      action: 'approve',
      categories: [],
      provider: 'noop',
    });
  });

  it('builds a webhook provider when configured', () => {
    const service = new ContentScanService(
      makeConfig({
        'contentScan.provider': 'webhook',
        'contentScan.webhookUrl': 'https://scan.example.com',
        'contentScan.webhookToken': 'token',
        'contentScan.timeoutMs': 5000,
      }) as never,
    );

    expect(service.isEnabled()).toBe(true);
    expect((service as unknown as { provider: unknown }).provider).toBeInstanceOf(WebhookContentScanProvider);
  });

  it('falls back to noop when provider=webhook but no URL is set', () => {
    const service = new ContentScanService(
      makeConfig({ 'contentScan.provider': 'webhook' }) as never,
    );

    expect(service.isEnabled()).toBe(false);
    expect((service as unknown as { provider: unknown }).provider).toBeInstanceOf(NoopContentScanProvider);
  });

  it('logs a warning when the verdict is not approve, but still returns it', async () => {
    const service = new ContentScanService(makeConfig({}) as never);
    const held = { action: 'hold' as const, categories: ['nudity'], provider: 'webhook' };
    (service as unknown as { provider: { name: string; scan: () => Promise<unknown> } }).provider = {
      name: 'webhook',
      scan: jest.fn().mockResolvedValue(held),
    };

    await expect(service.scanVideo(input)).resolves.toEqual(held);
  });
});
