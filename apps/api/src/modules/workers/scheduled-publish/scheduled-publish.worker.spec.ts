import { Job } from 'bullmq';
import { ScheduledPublishWorker } from './scheduled-publish.worker';
import { ScheduledPublishJob } from '../../content/scheduled-publish.constants';

describe('ScheduledPublishWorker', () => {
  let worker: ScheduledPublishWorker;
  const scheduledPublish = { runScheduledPublish: jest.fn().mockResolvedValue({ published: 0 }) };

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new ScheduledPublishWorker(scheduledPublish as never);
  });

  it('runs the scheduled publish scan', async () => {
    await worker.process({ data: {} } as Job<ScheduledPublishJob>);
    expect(scheduledPublish.runScheduledPublish).toHaveBeenCalledTimes(1);
  });

  it('propagates failures so BullMQ retries', async () => {
    scheduledPublish.runScheduledPublish.mockRejectedValueOnce(new Error('scan failed'));
    await expect(
      worker.process({ data: {} } as Job<ScheduledPublishJob>),
    ).rejects.toThrow('scan failed');
  });
});
