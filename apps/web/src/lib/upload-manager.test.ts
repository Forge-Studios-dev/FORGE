import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mocked by relative path — vi.mock's specifier matching runs before the
// tsconfig-paths alias resolution, so mocking '@/lib/*' would silently miss
// upload-manager.ts's actual imports.
const apiPost = vi.fn();
vi.mock('./api', () => ({
  api: { post: (...args: unknown[]) => apiPost(...args) },
}));

const putVideoToStorageFromPresign = vi.fn();
vi.mock('./upload-storage-multipart', () => ({
  putVideoToStorageFromPresign: (...args: unknown[]) => putVideoToStorageFromPresign(...args),
}));

vi.mock('./upload-thumbnail-store', () => ({
  getUploadThumbnail: () => null,
  resolveThumbnailContentType: () => 'image/jpeg',
}));

vi.mock('./upload-video', () => ({
  resolveVideoContentType: () => 'video/mp4',
}));

describe('runBackgroundUpload', () => {
  beforeEach(() => {
    vi.resetModules();
    apiPost.mockReset();
    putVideoToStorageFromPresign.mockReset();
  });

  it('does not cancel/delete the video on a transient upload failure — the session must stay resumable', async () => {
    const { runBackgroundUpload } = await import('./upload-manager');

    apiPost.mockResolvedValueOnce({
      data: { data: { videoId: 'video-1', uploadUrl: 'https://s3.example/upload' } },
    });
    putVideoToStorageFromPresign.mockRejectedValueOnce(new Error('network drop mid-PUT'));

    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });

    await expect(
      runBackgroundUpload(file, 'Title', 'Description', {}),
    ).rejects.toThrow('network drop mid-PUT');

    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost).not.toHaveBeenCalledWith(
      expect.stringContaining('/cancel-upload'),
    );
  });
});
