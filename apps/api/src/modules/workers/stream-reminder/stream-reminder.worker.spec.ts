import { Job } from 'bullmq';
import { StreamReminderWorker } from './stream-reminder.worker';

describe('StreamReminderWorker', () => {
  let worker: StreamReminderWorker;
  const streamRepository = { find: jest.fn(), update: jest.fn().mockResolvedValue(undefined) };
  const rsvpRepository = { find: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const muxLiveSyncService = { isPlatformDormant: jest.fn() };

  const job = { data: {} } as Job;

  beforeEach(() => {
    jest.clearAllMocks();
    muxLiveSyncService.isPlatformDormant.mockResolvedValue(false);
    streamRepository.find.mockResolvedValue([]);
    rsvpRepository.find.mockResolvedValue([]);
    worker = new StreamReminderWorker(
      streamRepository as never,
      rsvpRepository as never,
      eventEmitter as never,
      muxLiveSyncService as never,
    );
  });

  it('skips the scan entirely when the platform is dormant (cost guard)', async () => {
    muxLiveSyncService.isPlatformDormant.mockResolvedValue(true);
    await worker.process(job);
    expect(streamRepository.find).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('does not query RSVPs when there are no upcoming streams', async () => {
    await worker.process(job);
    expect(rsvpRepository.find).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('emits a reminder with batched RSVP recipients and marks the stream as reminded', async () => {
    const scheduledAt = new Date();
    streamRepository.find.mockResolvedValue([
      { id: 's1', userId: 'creator-1', title: 'Live A', scheduledAt, user: { displayName: 'Alice' } },
    ]);
    rsvpRepository.find.mockResolvedValue([
      { streamId: 's1', userId: 'fan-1' },
      { streamId: 's1', userId: 'fan-2' },
    ]);

    await worker.process(job);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'stream.reminder',
      expect.objectContaining({
        streamId: 's1',
        creatorName: 'Alice',
        rsvpUserIds: ['fan-1', 'fan-2'],
      }),
    );
    expect(streamRepository.update).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ reminderSentAt: expect.any(Date) }),
    );
  });

  it('emits an empty recipient list for streams without RSVPs', async () => {
    streamRepository.find.mockResolvedValue([
      { id: 's2', userId: 'creator-2', title: 'Live B', scheduledAt: new Date(), user: null },
    ]);
    rsvpRepository.find.mockResolvedValue([]);

    await worker.process(job);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'stream.reminder',
      expect.objectContaining({ streamId: 's2', rsvpUserIds: [], creatorName: undefined }),
    );
  });
});
