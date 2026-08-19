import { Job } from 'bullmq';
import { StreamMuxSyncWorker } from './stream-mux-sync.worker';
import { StreamMuxSyncJob } from './stream-mux-sync.constants';

describe('StreamMuxSyncWorker', () => {
  let worker: StreamMuxSyncWorker;
  const muxLiveSyncService = {
    syncStreamById: jest.fn().mockResolvedValue(undefined),
    finalizeIfGraceExpired: jest.fn().mockResolvedValue(undefined),
    runPeriodicScan: jest.fn().mockResolvedValue({ synced: 0, finalized: 0 }),
    isPlatformDormant: jest.fn().mockResolvedValue(false),
    hasActiveLiveStreams: jest.fn().mockResolvedValue(false),
    retryDisableLiveStream: jest.fn().mockResolvedValue(undefined),
  };
  const muxSyncScheduler = { syncIntervalForActivity: jest.fn().mockResolvedValue(undefined) };

  const makeJob = (data: StreamMuxSyncJob): Job<StreamMuxSyncJob> =>
    ({ data }) as Job<StreamMuxSyncJob>;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new StreamMuxSyncWorker(muxLiveSyncService as never, muxSyncScheduler as never);
  });

  it('runs delayed grace finalize without a periodic scan', async () => {
    await worker.process(makeJob({ finalizeStreamId: 'stream-1' }));
    expect(muxLiveSyncService.finalizeIfGraceExpired).toHaveBeenCalledWith('stream-1');
    expect(muxLiveSyncService.runPeriodicScan).not.toHaveBeenCalled();
    expect(muxLiveSyncService.syncStreamById).not.toHaveBeenCalled();
  });

  it('retries disabling a Mux live stream and skips the periodic scan', async () => {
    await worker.process(makeJob({ disableMuxLiveStreamId: 'mux-live-1' }));
    expect(muxLiveSyncService.retryDisableLiveStream).toHaveBeenCalledWith('mux-live-1');
    expect(muxLiveSyncService.runPeriodicScan).not.toHaveBeenCalled();
    expect(muxLiveSyncService.finalizeIfGraceExpired).not.toHaveBeenCalled();
  });

  it('syncs a single stream when a streamId is provided and skips the periodic scan', async () => {
    await worker.process(makeJob({ streamId: 'stream-1' }));
    expect(muxLiveSyncService.syncStreamById).toHaveBeenCalledWith('stream-1');
    expect(muxLiveSyncService.runPeriodicScan).not.toHaveBeenCalled();
  });

  it('runs the periodic scan and tightens the interval when live streams are active', async () => {
    muxLiveSyncService.runPeriodicScan.mockResolvedValue({ synced: 2, finalized: 1 });
    muxLiveSyncService.isPlatformDormant.mockResolvedValue(false);
    muxLiveSyncService.hasActiveLiveStreams.mockResolvedValue(true);

    await worker.process(makeJob({}));

    expect(muxLiveSyncService.runPeriodicScan).toHaveBeenCalled();
    expect(muxSyncScheduler.syncIntervalForActivity).toHaveBeenCalledWith({
      hasLiveStreams: true,
      isDormant: false,
    });
  });

  it('treats a dormant platform as having no live streams (cost guard)', async () => {
    muxLiveSyncService.isPlatformDormant.mockResolvedValue(true);

    await worker.process(makeJob({}));

    expect(muxLiveSyncService.hasActiveLiveStreams).not.toHaveBeenCalled();
    expect(muxSyncScheduler.syncIntervalForActivity).toHaveBeenCalledWith({
      hasLiveStreams: false,
      isDormant: true,
    });
  });
});
