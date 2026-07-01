import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StreamViewerService } from './stream-viewer.service';
import { StreamAnalyticsService } from './stream-analytics.service';
import { Stream } from './entities/stream.entity';

describe('StreamViewerService', () => {
  let service: StreamViewerService;
  const redis = {
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    pfadd: jest.fn().mockResolvedValue(1),
    pfcount: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    scard: jest.fn().mockResolvedValue(0),
    set: jest.fn(),
  };
  const streamRepository = { update: jest.fn().mockResolvedValue({ affected: 1 }), find: jest.fn() };
  const streamAnalyticsService = { recordSnapshot: jest.fn().mockResolvedValue(undefined) };
  const configService = { get: jest.fn().mockReturnValue(false) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        StreamViewerService,
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
        { provide: getRepositoryToken(Stream), useValue: streamRepository },
        { provide: StreamAnalyticsService, useValue: streamAnalyticsService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    service = moduleRef.get(StreamViewerService);
  });

  it('tracks a live stream in the live index', async () => {
    await service.trackStreamLive('s1');
    expect(redis.sadd).toHaveBeenCalledWith('streams:live:ids', 's1');
  });

  it('cleans up the viewer set and live index when a stream ends', async () => {
    await service.trackStreamEnded('s1');
    expect(redis.srem).toHaveBeenCalledWith('streams:live:ids', 's1');
    expect(redis.del).toHaveBeenCalledWith('stream:viewers:s1');
  });

  it('adds socket to viewer set and tracks the unique viewer on join', async () => {
    redis.scard.mockResolvedValueOnce(3);
    const count = await service.join('s1', 'socket-1', 'user-1');
    expect(redis.sadd).toHaveBeenCalledWith('stream:viewers:s1', 'socket-1');
    expect(redis.pfadd).toHaveBeenCalledWith('stream:unique:viewers:s1', 'user-1');
    expect(count).toBe(3);
  });

  it('does not track a unique viewer for anonymous joins', async () => {
    await service.join('s1', 'socket-1', null);
    expect(redis.pfadd).not.toHaveBeenCalled();
  });

  it('deletes the viewer set when the last viewer leaves', async () => {
    redis.scard.mockResolvedValueOnce(0);
    const count = await service.leave('s1', 'socket-1');
    expect(redis.srem).toHaveBeenCalledWith('stream:viewers:s1', 'socket-1');
    expect(redis.del).toHaveBeenCalledWith('stream:viewers:s1');
    expect(count).toBe(0);
  });

  it('finalizes unique viewers and clears the HLL key', async () => {
    redis.pfcount.mockResolvedValueOnce(42);
    const count = await service.finalizeUniqueViewers('s1');
    expect(count).toBe(42);
    expect(redis.del).toHaveBeenCalledWith('stream:unique:viewers:s1');
  });

  it('flushes the viewer count to Postgres and records a throttled snapshot', async () => {
    redis.scard.mockResolvedValueOnce(9);
    redis.set.mockResolvedValueOnce('OK');
    const count = await service.flushStream('s1');
    expect(count).toBe(9);
    expect(streamRepository.update).toHaveBeenCalledWith({ id: 's1' }, { viewerCount: 9 });
    expect(streamAnalyticsService.recordSnapshot).toHaveBeenCalledWith('s1', 9);
  });

  it('skips the snapshot when the throttle lock is not acquired', async () => {
    redis.scard.mockResolvedValueOnce(9);
    redis.set.mockResolvedValueOnce(null);
    await service.flushStream('s1');
    expect(streamAnalyticsService.recordSnapshot).not.toHaveBeenCalled();
  });

  it('syncCountsForStreams flushes each unique id once', async () => {
    redis.scard.mockResolvedValue(1);
    redis.set.mockResolvedValue(null);
    await service.syncCountsForStreams(['s1', 's1', 's2']);
    expect(streamRepository.update).toHaveBeenCalledTimes(2);
  });
});
