import { ShortsWatchPercentService } from './shorts-watch-percent.service';
import { PublishStatus, VideoStatus, VideoType } from './entities/video.entity';

describe('ShortsWatchPercentService', () => {
  const videoRepository = {
    query: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  let service: ShortsWatchPercentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ShortsWatchPercentService(videoRepository as never);
  });

  it('queries only recent, ready, published Shorts with watch history', async () => {
    videoRepository.query.mockResolvedValue([]);

    await service.recompute();

    expect(videoRepository.query).toHaveBeenCalledWith(
      expect.any(String),
      [expect.any(Date), VideoType.SHORT, VideoStatus.READY, PublishStatus.PUBLISHED, 2000],
    );
  });

  it('updates each returned video with its rounded completion percent and a fresh timestamp', async () => {
    videoRepository.query.mockResolvedValue([
      { video_id: 'v1', avg_watch_pct: '67.456' },
      { video_id: 'v2', avg_watch_pct: null },
    ]);

    const result = await service.recompute();

    expect(result).toEqual({ updated: 2 });
    expect(videoRepository.update).toHaveBeenCalledWith('v1', {
      avgWatchPercent: 67.5,
      watchPercentUpdatedAt: expect.any(Date),
    });
    expect(videoRepository.update).toHaveBeenCalledWith('v2', {
      avgWatchPercent: null,
      watchPercentUpdatedAt: expect.any(Date),
    });
  });

  it('does nothing when no Shorts have recent watch history', async () => {
    videoRepository.query.mockResolvedValue([]);

    const result = await service.recompute();

    expect(result).toEqual({ updated: 0 });
    expect(videoRepository.update).not.toHaveBeenCalled();
  });
});
