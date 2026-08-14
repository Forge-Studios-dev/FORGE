import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from './api';
import { blockUser, isInWatchLater, unblockUser } from './engage-mutations';

describe('isInWatchLater', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('reads nested data.inWatchLater', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { inWatchLater: true } } });
    await expect(isInWatchLater('v1')).resolves.toBe(true);
  });

  it('reads flat inWatchLater when unwrapped', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { inWatchLater: false } });
    await expect(isInWatchLater('v1')).resolves.toBe(false);
  });
});

describe('blockUser / unblockUser', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
    vi.mocked(api.delete).mockReset();
  });

  it('posts and deletes block routes', async () => {
    vi.mocked(api.post).mockResolvedValue({});
    vi.mocked(api.delete).mockResolvedValue({});
    await blockUser('u2');
    await unblockUser('u2');
    expect(api.post).toHaveBeenCalledWith('/users/u2/block');
    expect(api.delete).toHaveBeenCalledWith('/users/u2/block');
  });
});
