import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MuxLiveSyncService } from './mux-live-sync.service';
import { Stream, StreamStatus } from './entities/stream.entity';
import { StreamViewerService } from './stream-viewer.service';

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
  };
  const streamRepositoryWithCount = {
    ...streamRepository,
    count: jest.fn().mockResolvedValue(0),
  };
  const streamViewerService = {
    trackStreamEnded: jest.fn().mockResolvedValue(undefined),
    trackStreamLive: jest.fn().mockResolvedValue(undefined),
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
              if (key === 'mux.tokenId') return 'placeholder';
              if (key === 'mux.tokenSecret') return 'placeholder';
              return undefined;
            },
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: StreamViewerService, useValue: streamViewerService },
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
      1200,
      '1',
    );
  });

  it('skips periodic scan when platform dormant flag is set', async () => {
    redis.get.mockResolvedValue('1');

    const result = await service.runPeriodicScan();

    expect(result).toEqual({ synced: 0, finalized: 0 });
    expect(streamRepositoryWithCount.count).not.toHaveBeenCalled();
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
});
