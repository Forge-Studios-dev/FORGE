import { IsNull, LessThanOrEqual } from 'typeorm';
import Redis from 'ioredis';
import { ScheduledPublishService } from './scheduled-publish.service';
import { SCHEDULED_PUBLISH_PENDING_KEY } from './scheduled-publish.constants';
import {
  ModerationStatus,
  PublishStatus,
  VideoStatus,
  VideoVisibility,
} from './entities/video.entity';

describe('ScheduledPublishService', () => {
  const videoRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const videosService = { bustVideoDetailCache: jest.fn().mockResolvedValue(undefined) };
  const eventEmitter = { emit: jest.fn() };
  const redis = {
    scard: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
  };

  let service: ScheduledPublishService;

  beforeEach(() => {
    jest.clearAllMocks();
    redis.scard.mockResolvedValue(1);
    service = new ScheduledPublishService(
      videoRepository as never,
      videosService as never,
      eventEmitter as never,
      redis as unknown as Redis,
    );
  });

  it('skips Postgres when the pending set is empty', async () => {
    redis.scard.mockResolvedValue(0);

    const result = await service.runScheduledPublish();

    expect(result).toEqual({ published: 0 });
    expect(videoRepository.find).not.toHaveBeenCalled();
    expect(redis.scard).toHaveBeenCalledWith(SCHEDULED_PUBLISH_PENDING_KEY);
  });

  it('queries only id and userId for due, ready, public, unmoderated videos', async () => {
    videoRepository.find.mockResolvedValue([]);

    await service.runScheduledPublish();

    expect(videoRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        select: ['id', 'userId'],
        where: expect.objectContaining({
          status: VideoStatus.READY,
          publishStatus: PublishStatus.PUBLISHED,
          visibility: VideoVisibility.PUBLIC,
          moderationStatus: ModerationStatus.NONE,
          scheduledPublishAt: LessThanOrEqual(expect.any(Date)),
          indexedAt: IsNull(),
        }),
      }),
    );
  });

  it('clears the pending set when the backup find returns no due videos', async () => {
    videoRepository.find.mockResolvedValue([]);

    await service.runScheduledPublish();

    expect(redis.del).toHaveBeenCalledWith(SCHEDULED_PUBLISH_PENDING_KEY);
  });

  it('indexes each due video, busts its cache, and emits video.published', async () => {
    videoRepository.find.mockResolvedValue([
      { id: 'v1', userId: 'u1' },
      { id: 'v2', userId: 'u2' },
    ]);

    const result = await service.runScheduledPublish();

    expect(result).toEqual({ published: 2 });
    expect(videoRepository.update).toHaveBeenCalledWith('v1', { indexedAt: expect.any(Date) });
    expect(videoRepository.update).toHaveBeenCalledWith('v2', { indexedAt: expect.any(Date) });
    expect(videosService.bustVideoDetailCache).toHaveBeenCalledWith('v1');
    expect(videosService.bustVideoDetailCache).toHaveBeenCalledWith('v2');
    expect(redis.srem).toHaveBeenCalledWith(SCHEDULED_PUBLISH_PENDING_KEY, 'v1');
    expect(redis.srem).toHaveBeenCalledWith(SCHEDULED_PUBLISH_PENDING_KEY, 'v2');
    expect(eventEmitter.emit).toHaveBeenCalledWith('video.published', {
      videoId: 'v1',
      userId: 'u1',
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith('video.published', {
      videoId: 'v2',
      userId: 'u2',
    });
  });

  it('does nothing when no videos are due', async () => {
    videoRepository.find.mockResolvedValue([]);

    const result = await service.runScheduledPublish();

    expect(result).toEqual({ published: 0 });
    expect(videoRepository.update).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('publishVideoIfDue indexes a single matching video', async () => {
    videoRepository.findOne.mockResolvedValue({ id: 'v1', userId: 'u1' });

    const result = await service.publishVideoIfDue('v1');

    expect(result).toEqual({ published: 1 });
    expect(videoRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        select: ['id', 'userId'],
        where: expect.objectContaining({ id: 'v1' }),
      }),
    );
    expect(videoRepository.update).toHaveBeenCalledWith('v1', { indexedAt: expect.any(Date) });
    expect(redis.srem).toHaveBeenCalledWith(SCHEDULED_PUBLISH_PENDING_KEY, 'v1');
  });

  it('publishVideoIfDue no-ops and clears pending when the video is not due', async () => {
    videoRepository.findOne.mockResolvedValue(null);

    const result = await service.publishVideoIfDue('v1');

    expect(result).toEqual({ published: 0 });
    expect(videoRepository.update).not.toHaveBeenCalled();
    expect(redis.srem).toHaveBeenCalledWith(SCHEDULED_PUBLISH_PENDING_KEY, 'v1');
  });
});
