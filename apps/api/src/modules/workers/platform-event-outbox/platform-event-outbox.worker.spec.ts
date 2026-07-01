import { Job } from 'bullmq';
import { PlatformEventOutboxWorker } from './platform-event-outbox.worker';
import type { PlatformEventOutboxJobData } from './platform-event-outbox.constants';

describe('PlatformEventOutboxWorker', () => {
  let worker: PlatformEventOutboxWorker;
  const outboxService = { dispatchEvent: jest.fn().mockResolvedValue(undefined) };

  const job = { data: { eventId: 'evt-1' } } as Job<PlatformEventOutboxJobData>;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new PlatformEventOutboxWorker(outboxService as never);
  });

  it('dispatches the outbox event by id', async () => {
    await worker.process(job);
    expect(outboxService.dispatchEvent).toHaveBeenCalledWith('evt-1');
  });

  it('propagates dispatch failures so the job is retried', async () => {
    outboxService.dispatchEvent.mockRejectedValueOnce(new Error('dispatch failed'));
    await expect(worker.process(job)).rejects.toThrow('dispatch failed');
  });
});
