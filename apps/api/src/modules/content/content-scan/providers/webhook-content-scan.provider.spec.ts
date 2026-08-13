import { WebhookContentScanProvider } from './webhook-content-scan.provider';

const input = {
  videoId: 'video-1',
  userId: 'user-1',
  hlsUrl: 'https://example.com/hls.m3u8',
  thumbnailUrl: 'https://example.com/thumb.jpg',
};

function mockFetch(impl: () => Promise<unknown>) {
  global.fetch = jest.fn().mockImplementation(impl) as unknown as typeof fetch;
}

describe('WebhookContentScanProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts the input and returns the endpoint verdict', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ action: 'block', categories: ['csam'] }),
      }),
    );
    const provider = new WebhookContentScanProvider({
      url: 'https://scan.example.com/scan',
      authToken: 'secret-token',
      timeoutMs: 5000,
    });

    const verdict = await provider.scan(input);

    expect(verdict).toEqual({
      action: 'block',
      categories: ['csam'],
      provider: 'webhook',
      raw: { action: 'block', categories: ['csam'] },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://scan.example.com/scan',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
        body: JSON.stringify(input),
      }),
    );
  });

  it('defaults to approve when categories are omitted', async () => {
    mockFetch(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ action: 'approve' }) }),
    );
    const provider = new WebhookContentScanProvider({ url: 'https://scan.example.com', timeoutMs: 5000 });

    const verdict = await provider.scan(input);

    expect(verdict).toEqual({ action: 'approve', categories: [], provider: 'webhook', raw: { action: 'approve' } });
  });

  it('fails closed to hold on a non-2xx response', async () => {
    mockFetch(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }));
    const provider = new WebhookContentScanProvider({ url: 'https://scan.example.com', timeoutMs: 5000 });

    const verdict = await provider.scan(input);

    expect(verdict).toEqual({ action: 'hold', categories: ['scan_unavailable'], provider: 'webhook' });
  });

  it('fails closed to hold when the request throws (timeout/network error)', async () => {
    mockFetch(() => Promise.reject(new Error('network down')));
    const provider = new WebhookContentScanProvider({ url: 'https://scan.example.com', timeoutMs: 5000 });

    const verdict = await provider.scan(input);

    expect(verdict).toEqual({ action: 'hold', categories: ['scan_unavailable'], provider: 'webhook' });
  });

  it('treats an unrecognized action as hold', async () => {
    mockFetch(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ action: 'yolo' }) }),
    );
    const provider = new WebhookContentScanProvider({ url: 'https://scan.example.com', timeoutMs: 5000 });

    const verdict = await provider.scan(input);

    expect(verdict.action).toBe('hold');
  });
});
