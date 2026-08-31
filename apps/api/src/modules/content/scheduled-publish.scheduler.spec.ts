import { Queue } from 'bullmq';
import Redis from 'ioredis';
import {
  ScheduledPublishScheduler,
  SCHEDULED_PUBLISH_BACKUP_INTERVAL_MS,
} from './scheduled-publish.scheduler';
import { SCHEDULED_PUBLISH_PENDING_KEY } from './scheduled-publish.constants';

describe('ScheduledPublishScheduler', () => {
  const queue = {
    getJob: jest.fn(),
    add: jest.fn().mockResolvedValue(undefined),
    upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
  };
  const redis = {
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
  };
  let scheduler: ScheduledPublishScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new ScheduledPublishScheduler(
      queue as unknown as Queue,
      redis as unknown as Redis,
    );
  });

  it('uses a 30-minute backup interval', () => {
    expect(SCHEDULED_PUBLISH_BACKUP_INTERVAL_MS).toBe(30 * 60 * 1000);
  });

  it('enqueues a delayed job and tracks pending in Redis', async () => {
    queue.getJob.mockResolvedValue(null);
    const when = new Date(Date.now() + 30 * 60_000);
    await scheduler.schedulePublish('v1', when);

    expect(queue.add).toHaveBeenCalledWith(
      'publish',
      { videoId: 'v1' },
      expect.objectContaining({
        jobId: 'scheduled-publish:v1',
        delay: expect.any(Number),
      }),
    );
    const delay = (queue.add.mock.calls[0][2] as { delay: number }).delay;
    expect(delay).toBeGreaterThan(20 * 60_000);
    expect(delay).toBeLessThanOrEqual(30 * 60_000);
    expect(redis.sadd).toHaveBeenCalledWith(SCHEDULED_PUBLISH_PENDING_KEY, 'v1');
  });

  it('replaces an existing delayed job', async () => {
    const existing = { remove: jest.fn().mockResolvedValue(undefined) };
    queue.getJob.mockResolvedValue(existing);
    await scheduler.schedulePublish('v1', new Date(Date.now() + 60_000));
    expect(existing.remove).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalled();
    expect(redis.sadd).toHaveBeenCalledWith(SCHEDULED_PUBLISH_PENDING_KEY, 'v1');
  });

  it('enqueues immediately when the schedule is already due', async () => {
    queue.getJob.mockResolvedValue(null);
    await scheduler.schedulePublish('v1', new Date(Date.now() - 1000));
    expect(queue.add).toHaveBeenCalledWith(
      'publish',
      { videoId: 'v1' },
      expect.objectContaining({ delay: 0, jobId: 'scheduled-publish:v1' }),
    );
  });

  it('cancels a pending delayed job and clears Redis', async () => {
    const existing = { remove: jest.fn().mockResolvedValue(undefined) };
    queue.getJob.mockResolvedValue(existing);
    await scheduler.cancelPublish('v1');
    expect(queue.getJob).toHaveBeenCalledWith('scheduled-publish:v1');
    expect(existing.remove).toHaveBeenCalled();
    expect(redis.srem).toHaveBeenCalledWith(SCHEDULED_PUBLISH_PENDING_KEY, 'v1');
  });
});
