import { Job } from 'bullmq';
import { PremiumContentNotifyWorker } from './premium-content-notify.worker';
import type { PremiumContentNotifyJobData } from './premium-content-notify.constants';

describe('PremiumContentNotifyWorker', () => {
  let worker: PremiumContentNotifyWorker;
  const premiumContentNotify = { fanOut: jest.fn().mockResolvedValue(undefined) };

  const job = {
    data: { videoId: 'video-1', creatorId: 'creator-1' },
  } as Job<PremiumContentNotifyJobData>;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new PremiumContentNotifyWorker(premiumContentNotify as never);
  });

  it('fans out premium content notifications', async () => {
    await worker.process(job);
    expect(premiumContentNotify.fanOut).toHaveBeenCalledWith(job.data);
  });

  it('propagates fan-out failures for retry', async () => {
    premiumContentNotify.fanOut.mockRejectedValueOnce(new Error('fanout failed'));
    await expect(worker.process(job)).rejects.toThrow('fanout failed');
  });
});
