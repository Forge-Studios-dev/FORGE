import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('refreshAccessToken single-flight', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('shares one in-flight refresh across concurrent callers', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        data: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          user: { id: 'u1' },
          sessionId: 's1',
        },
      },
    });
    vi.doMock('axios', () => ({
      default: { post },
      post,
    }));
    vi.doMock('@/lib/auth-storage', () => ({
      clearAuthSession: vi.fn(),
      persistAuthSession: vi.fn(),
    }));
    vi.doMock('@/lib/csrf', () => ({
      csrfRequestHeaders: () => ({}),
    }));

    const { refreshAccessToken } = await import('./auth-refresh');
    const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);
    expect(a).toBe('new-access');
    expect(b).toBe('new-access');
    expect(post).toHaveBeenCalledTimes(1);
  });
});
