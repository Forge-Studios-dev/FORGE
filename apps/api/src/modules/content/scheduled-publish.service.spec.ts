import { IsNull, LessThanOrEqual } from 'typeorm';
import { ScheduledPublishService } from './scheduled-publish.service';
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

  let service: ScheduledPublishService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ScheduledPublishService(
      videoRepository as never,
      videosService as never,
      eventEmitter as never,
    );
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
  });

  it('publishVideoIfDue no-ops when the video is not due', async () => {
    videoRepository.findOne.mockResolvedValue(null);

    const result = await service.publishVideoIfDue('v1');

    expect(result).toEqual({ published: 0 });
    expect(videoRepository.update).not.toHaveBeenCalled();
  });
});
