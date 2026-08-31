import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MuxLiveSyncService } from './mux-live-sync.service';
import { Stream, StreamEndReason, StreamStatus } from './entities/stream.entity';
import { StreamViewerService } from './stream-viewer.service';
import { STREAM_MUX_SYNC_QUEUE } from '../workers/stream-mux-sync/stream-mux-sync.constants';

describe('MuxLiveSyncService idle grace finalization', () => {
  let service: MuxLiveSyncService;
  const streamRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    scard: jest.fn().mockResolvedValue(0),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  };
  const streamRepositoryWithCount = {
    ...streamRepository,
    count: jest.fn().mockResolvedValue(0),
  };
  const streamViewerService = {
    trackStreamEnded: jest.fn().mockResolvedValue(undefined),
    trackStreamLive: jest.fn().mockResolvedValue(undefined),
    finalizeUniqueViewers: jest.fn().mockResolvedValue(0),
  };
  const eventEmitter = { emit: jest.fn() };
  const muxSyncQueue = {
    add: jest.fn().mockResolvedValue(undefined),
    getJob: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MuxLiveSyncService,
        { provide: getRepositoryToken(Stream), useValue: streamRepositoryWithCount },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'mux.idleGraceSec') return 60;
              if (key === 'mux.maxReconnectAttempts') return 20;
              if (key === 'mux.tokenId') return 'placeholder';
              if (key === 'mux.tokenSecret') return 'placeholder';
              return undefined;
            },
          },
        },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: StreamViewerService, useValue: streamViewerService },
        { provide: getQueueToken(STREAM_MUX_SYNC_QUEUE), useValue: muxSyncQueue },
      ],
    }).compile();

    service = module.get(MuxLiveSyncService);
  });

  it('skips periodic scan when no live or idle mux candidates', async () => {
    redis.scard.mockResolvedValue(0);
    streamRepositoryWithCount.count.mockResolvedValue(0);
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');

    const result = await service.runPeriodicScan();

    expect(result).toEqual({ synced: 0, finalized: 0 });
    expect(streamRepository.find).not.toHaveBeenCalled();
    expect(redis.setex).toHaveBeenCalledWith(
      MuxLiveSyncService.PLATFORM_DORMANT_KEY,
      MuxLiveSyncService.PLATFORM_DORMANT_TTL_SEC,
      '1',
    );
  });

  it('skips periodic scan when platform dormant flag is set', async () => {
    redis.get.mockResolvedValue('1');
    redis.setex.mockResolvedValue('OK');

    const result = await service.runPeriodicScan();

    expect(result).toEqual({ synced: 0, finalized: 0 });
    expect(streamRepositoryWithCount.count).not.toHaveBeenCalled();
    // Refresh TTL so dormant job ticks do not let the key expire mid-gap.
    expect(redis.setex).toHaveBeenCalledWith(
      MuxLiveSyncService.PLATFORM_DORMANT_KEY,
      MuxLiveSyncService.PLATFORM_DORMANT_TTL_SEC,
      '1',
    );
  });

  it('uses a dormant TTL at least 2× the dormant job interval', () => {
    expect(MuxLiveSyncService.PLATFORM_DORMANT_TTL_SEC).toBeGreaterThanOrEqual(1800);
  });

  it('finalizes LIVE streams past mux idle grace during periodic scan', async () => {
    const stale = {
      id: 'stream-1',
      userId: 'creator-1',
      title: 'Stale live',
      status: StreamStatus.LIVE,
      muxIdleSince: new Date(Date.now() - 120_000),
    } as Stream;

    streamRepositoryWithCount.count.mockResolvedValueOnce(1).mockResolvedValue(0);
    redis.get.mockResolvedValue(null);
    redis.scard.mockResolvedValue(1);
    streamRepository.find
      .mockResolvedValueOnce([stale])
      .mockResolvedValueOnce([]);
    redis.set.mockResolvedValue('OK');

    const result = await service.runPeriodicScan();

    expect(result.finalized).toBe(1);
    expect(streamRepository.update).toHaveBeenCalledWith(
      'stream-1',
      expect.objectContaining({ status: StreamStatus.ENDED }),
    );
  });

  it('sets endReason=connection_lost and finalizes unique viewers on auto-terminate', async () => {
    const stale = {
      id: 'stream-1',
      userId: 'creator-1',
      title: 'Stale live',
      status: StreamStatus.LIVE,
      muxIdleSince: new Date(Date.now() - 120_000),
    } as Stream;
    streamViewerService.finalizeUniqueViewers.mockResolvedValueOnce(42);

    await service.finalizeStreamEnded(stale);

    expect(streamViewerService.finalizeUniqueViewers).toHaveBeenCalledWith('stream-1');
    expect(streamRepository.update).toHaveBeenCalledWith(
      'stream-1',
      expect.objectContaining({
        status: StreamStatus.ENDED,
        endReason: StreamEndReason.CONNECTION_LOST,
        uniqueViewerCount: 42,
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'stream.ended',
      expect.objectContaining({ streamId: 'stream-1', endReason: StreamEndReason.CONNECTION_LOST }),
    );
  });

  it('is a no-op when the stream is already ENDED', async () => {
    const ended = { id: 'stream-2', status: StreamStatus.ENDED } as Stream;

    await service.finalizeStreamEnded(ended);

    expect(streamRepository.update).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('emits stream.reconnecting on first Mux webhook idle event', async () => {
    const live = {
      id: 'stream-3',
      userId: 'creator-1',
      status: StreamStatus.LIVE,
      muxIdleSince: null,
    } as Stream;
    streamRepositoryWithCount.findOne.mockResolvedValue(live);
    redis.incr.mockResolvedValue(1);

    await service.handleWebhookIdle('mux-live-3');

    expect(streamRepository.update).toHaveBeenCalledWith(
      { muxLiveStreamId: 'mux-live-3' },
      expect.objectContaining({ muxIdleSince: expect.any(Date) }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'stream.reconnecting',
      expect.objectContaining({ streamId: 'stream-3', timeoutSec: 60, attempt: 1 }),
    );
    expect(muxSyncQueue.add).toHaveBeenCalledWith(
      'finalize-grace',
      { finalizeStreamId: 'stream-3' },
      expect.objectContaining({
        jobId: 'mux-grace-finalize:stream-3',
        delay: 60_000,
      }),
    );
  });

  it('does not re-emit stream.reconnecting on repeated idle webhooks', async () => {
    const alreadyIdle = {
      id: 'stream-4',
      userId: 'creator-1',
      status: StreamStatus.LIVE,
      muxIdleSince: new Date(),
    } as Stream;
    streamRepositoryWithCount.findOne.mockResolvedValue(alreadyIdle);

    await service.handleWebhookIdle('mux-live-4');

    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      'stream.reconnecting',
      expect.anything(),
    );
    expect(muxSyncQueue.add).not.toHaveBeenCalled();
  });

  it('emits stream.reconnected when the host resumes after an idle period', async () => {
    const reconnecting = {
      id: 'stream-5',
      userId: 'creator-1',
      status: StreamStatus.LIVE,
      startedAt: new Date(),
      muxIdleSince: new Date(),
      thumbnailUrl: 'https://example.com/thumb.jpg',
    } as Stream;
    // handleWebhookActive only calls findOne a second time when the first
    // lookup returns null (`stream ?? await findOne(...)`) — queuing a second
    // Once value here would go unconsumed and leak into the next test.
    streamRepositoryWithCount.findOne.mockResolvedValueOnce(reconnecting);

    await service.handleWebhookActive('mux-live-5');

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'stream.reconnected',
      expect.objectContaining({ streamId: 'stream-5' }),
    );
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('stream.started', expect.anything());
  });

  it('does not resurrect a stream already auto-terminated (late/out-of-order Mux active webhook)', async () => {
    const ended = {
      id: 'stream-6',
      userId: 'creator-1',
      status: StreamStatus.ENDED,
      endedAt: new Date(),
      muxIdleSince: null,
    } as Stream;
    streamRepositoryWithCount.findOne.mockResolvedValue(ended);

    await service.handleWebhookActive('mux-live-6');

    expect(streamRepository.update).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('skips finalizing a stream a sibling replica already claimed via the per-stream lock', async () => {
    const stale = {
      id: 'stream-7',
      userId: 'creator-1',
      title: 'Stale live',
      status: StreamStatus.LIVE,
      muxIdleSince: new Date(Date.now() - 120_000),
    } as Stream;
    streamRepositoryWithCount.count.mockResolvedValueOnce(1).mockResolvedValue(0);
    redis.get.mockResolvedValue(null);
    redis.scard.mockResolvedValue(1);
    streamRepository.find.mockResolvedValueOnce([stale]).mockResolvedValueOnce([]);
    redis.set.mockResolvedValue(null); // another replica already holds the lock

    const result = await service.runPeriodicScan();

    expect(result.finalized).toBe(0);
    expect(streamRepository.update).not.toHaveBeenCalledWith(
      'stream-7',
      expect.objectContaining({ status: StreamStatus.ENDED }),
    );
  });

  it('marks platform dormant when only abandoned IDLE mux rooms exist (outside poll window)', async () => {
    redis.scard.mockResolvedValue(0);
    // grace work: 0; idle poll candidates (filtered): 0 — abandoned rooms no longer count
    streamRepositoryWithCount.count.mockResolvedValue(0);
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue('OK');

    const result = await service.runPeriodicScan();

    expect(result).toEqual({ synced: 0, finalized: 0 });
    expect(streamRepository.find).not.toHaveBeenCalled();
    expect(redis.setex).toHaveBeenCalledWith(
      MuxLiveSyncService.PLATFORM_DORMANT_KEY,
      MuxLiveSyncService.PLATFORM_DORMANT_TTL_SEC,
      '1',
    );
  });

  it('finalizes via delayed job when reconnect grace has expired', async () => {
    const stale = {
      id: 'stream-8',
      userId: 'creator-1',
      title: 'Stale',
      status: StreamStatus.LIVE,
      muxIdleSince: new Date(Date.now() - 120_000),
      communityId: null,
    } as Stream;
    streamRepositoryWithCount.findOne.mockResolvedValue(stale);
    redis.set.mockResolvedValue('OK');

    await service.finalizeIfGraceExpired('stream-8');

    expect(streamRepository.update).toHaveBeenCalledWith(
      'stream-8',
      expect.objectContaining({
        status: StreamStatus.ENDED,
        endReason: StreamEndReason.CONNECTION_LOST,
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'stream.ended',
      expect.objectContaining({ streamId: 'stream-8' }),
    );
  });

  it('skips delayed finalize when host already reconnected', async () => {
    const live = {
      id: 'stream-9',
      status: StreamStatus.LIVE,
      muxIdleSince: null,
    } as Stream;
    streamRepositoryWithCount.findOne.mockResolvedValue(live);

    await service.finalizeIfGraceExpired('stream-9');

    expect(streamRepository.update).not.toHaveBeenCalled();
  });

  it('enqueues a backed-off retry job when a Mux live-stream disable call needs retrying', async () => {
    await service.scheduleDisableRetry('mux-live-stuck');

    expect(muxSyncQueue.add).toHaveBeenCalledWith(
      'disable-live-stream',
      { disableMuxLiveStreamId: 'mux-live-stuck' },
      expect.objectContaining({ attempts: 5 }),
    );
  });
});
