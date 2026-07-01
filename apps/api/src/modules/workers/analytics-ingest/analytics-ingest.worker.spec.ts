import { Job } from 'bullmq';
import { AnalyticsIngestWorker, AnalyticsIngestJob } from './analytics-ingest.worker';

describe('AnalyticsIngestWorker', () => {
  let worker: AnalyticsIngestWorker;
  const analyticsRepository = {
    create: jest.fn((x) => x),
    save: jest.fn().mockResolvedValue({}),
  };

  const makeJob = (data: AnalyticsIngestJob): Job<AnalyticsIngestJob> =>
    ({ data }) as Job<AnalyticsIngestJob>;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new AnalyticsIngestWorker(analyticsRepository as never);
  });

  it('persists the analytics event with its full payload', async () => {
    await worker.process(
      makeJob({
        eventName: 'video_view',
        properties: { duration: 30 },
        userId: 'user-1',
        videoId: 'video-1',
      }),
    );
    expect(analyticsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'video_view',
        properties: { duration: 30 },
        userId: 'user-1',
        videoId: 'video-1',
      }),
    );
  });

  it('persists anonymous events with null user/video references', async () => {
    await worker.process(
      makeJob({ eventName: 'page_view', properties: null, userId: null, videoId: null }),
    );
    expect(analyticsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'page_view', userId: null, videoId: null }),
    );
  });
});
