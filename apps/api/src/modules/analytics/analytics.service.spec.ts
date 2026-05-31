import { BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const analyticsQueue = { add: jest.fn().mockResolvedValue(undefined) };
  const service = new AnalyticsService({} as never, analyticsQueue as never);

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
});
