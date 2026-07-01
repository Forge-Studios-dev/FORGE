import { Job } from 'bullmq';
import { AnalyticsRetentionWorker } from './analytics-retention.worker';
import { AnalyticsRetentionJob } from '../../analytics/analytics-retention.constants';

describe('AnalyticsRetentionWorker', () => {
  let worker: AnalyticsRetentionWorker;
  const retention = { runRetention: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new AnalyticsRetentionWorker(retention as never);
  });

  it('runs analytics retention on schedule', async () => {
    await worker.process({ data: {} } as Job<AnalyticsRetentionJob>);
    expect(retention.runRetention).toHaveBeenCalledTimes(1);
  });

  it('propagates failures so BullMQ retries', async () => {
    retention.runRetention.mockRejectedValueOnce(new Error('retention failed'));
    await expect(
      worker.process({ data: {} } as Job<AnalyticsRetentionJob>),
    ).rejects.toThrow('retention failed');
  });
});
