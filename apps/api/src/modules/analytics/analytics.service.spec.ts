import { BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const analyticsQueue = { add: jest.fn().mockResolvedValue(undefined) };
  const dataSource = {
    query: jest.fn(),
  };
  const service = new AnalyticsService(
    {} as never,
    analyticsQueue as never,
    dataSource as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unknown event names', async () => {
    await expect(
      service.ingest(null, { eventName: 'unknown.event' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(analyticsQueue.add).not.toHaveBeenCalled();
  });

  it('enqueues allowlisted events', async () => {
    await service.ingest('user-1', {
      eventName: 'watch.progress',
      properties: { positionSec: 10 },
      videoId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(analyticsQueue.add).toHaveBeenCalledWith(
      'ingest',
      expect.objectContaining({
        eventName: 'watch.progress',
        userId: 'user-1',
      }),
      expect.any(Object),
    );
  });

  it('rejects oversized properties', async () => {
    const huge = { blob: 'x'.repeat(5000) };
    await expect(
      service.ingest(null, { eventName: 'navigation.page', properties: huge }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('computes studio video performance CTR and watch %', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ impressions: '10', views: '5', avg_watch_pct: '42.5' }])
      .mockResolvedValueOnce([
        {
          video_id: 'v1',
          title: 'Hello',
          views: '5',
          impressions: '10',
          avg_watch_pct: '40',
        },
      ]);
    const result = await service.getStudioVideoPerformance('creator-1', 28);
    expect(result.impressions).toBe(10);
    expect(result.views).toBe(5);
    expect(result.ctr).toBe(0.5);
    expect(result.avgWatchPercent).toBe(42.5);
    expect(result.topVideos[0]).toMatchObject({
      videoId: 'v1',
      ctr: 0.5,
      avgWatchPercent: 40,
    });
    // watch_history uses watched_at (no created_at column)
    expect(String(dataSource.query.mock.calls[0][0])).toContain('wh.watched_at');
    expect(String(dataSource.query.mock.calls[1][0])).toContain('wh.watched_at');
    expect(String(dataSource.query.mock.calls[0][0])).not.toContain('wh.created_at');
  });
});
