import { Job } from 'bullmq';
import { ScheduledPublishWorker } from './scheduled-publish.worker';
import { ScheduledPublishJob } from '../../content/scheduled-publish.constants';

describe('ScheduledPublishWorker', () => {
  let worker: ScheduledPublishWorker;
  const scheduledPublish = {
    runScheduledPublish: jest.fn().mockResolvedValue({ published: 0 }),
    publishVideoIfDue: jest.fn().mockResolvedValue({ published: 0 }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new ScheduledPublishWorker(scheduledPublish as never);
  });

  it('runs the backup scan when the job has no videoId', async () => {
    await worker.process({ data: {} } as Job<ScheduledPublishJob>);
    expect(scheduledPublish.runScheduledPublish).toHaveBeenCalledTimes(1);
    expect(scheduledPublish.publishVideoIfDue).not.toHaveBeenCalled();
  });

  it('indexes one video for a delayed job', async () => {
    await worker.process({ data: { videoId: 'v1' } } as Job<ScheduledPublishJob>);
    expect(scheduledPublish.publishVideoIfDue).toHaveBeenCalledWith('v1');
    expect(scheduledPublish.runScheduledPublish).not.toHaveBeenCalled();
  });

  it('propagates failures so BullMQ retries', async () => {
    scheduledPublish.runScheduledPublish.mockRejectedValueOnce(new Error('scan failed'));
    await expect(
      worker.process({ data: {} } as Job<ScheduledPublishJob>),
    ).rejects.toThrow('scan failed');
  });
});
