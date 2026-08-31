import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import {
  ModerationStatus,
  PublishStatus,
  Video,
  VideoStatus,
  VideoVisibility,
} from './entities/video.entity';
import { VideosService } from './videos.service';
import { SCHEDULED_PUBLISH_PENDING_KEY } from './scheduled-publish.constants';

/**
 * Closes the gap where `scheduledPublishAt` only gated discovery via
 * query-time filtering: `indexedAt` was set at transcode-ready time based on
 * whether the schedule had *already* passed, and nothing ever revisited it —
 * so a video scheduled for the future stayed permanently un-indexed (never
 * appeared in feed/search) once ready, unless a creator happened to edit it
 * again after the scheduled time. Primary path is a delayed Bull job at
 * `scheduledPublishAt`; a 30-minute backup scan catches missed jobs and only
 * hits Postgres when Redis `videos:scheduled:pending` is non-empty.
 */
@Injectable()
export class ScheduledPublishService {
  private readonly logger = new Logger(ScheduledPublishService.name);
  private static readonly MAX_PER_RUN = 500;

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly videosService: VideosService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async runScheduledPublish(): Promise<{ published: number }> {
    try {
      const pending = await this.redis.scard(SCHEDULED_PUBLISH_PENDING_KEY);
      if (pending === 0) {
        return { published: 0 };
      }
    } catch (err) {
      this.logger.warn(
        `Scheduled publish pending-set check failed (falling through to Postgres): ${(err as Error).message}`,
      );
    }

    const now = new Date();
    const due = await this.videoRepository.find({
      select: ['id', 'userId'],
      where: {
        status: VideoStatus.READY,
        publishStatus: PublishStatus.PUBLISHED,
        visibility: VideoVisibility.PUBLIC,
        moderationStatus: ModerationStatus.NONE,
        scheduledPublishAt: LessThanOrEqual(now),
        indexedAt: IsNull(),
      },
      take: ScheduledPublishService.MAX_PER_RUN,
    });

    if (!due.length) {
      try {
        await this.redis.del(SCHEDULED_PUBLISH_PENDING_KEY);
      } catch {
        // non-fatal
      }
      return { published: 0 };
    }

    return this.indexDue(due, now);
  }

  async publishVideoIfDue(videoId: string): Promise<{ published: number }> {
    const now = new Date();
    const video = await this.videoRepository.findOne({
      select: ['id', 'userId'],
      where: {
        id: videoId,
        status: VideoStatus.READY,
        publishStatus: PublishStatus.PUBLISHED,
        visibility: VideoVisibility.PUBLIC,
        moderationStatus: ModerationStatus.NONE,
        scheduledPublishAt: LessThanOrEqual(now),
        indexedAt: IsNull(),
      },
    });
    if (!video) {
      await this.clearPending(videoId);
      return { published: 0 };
    }
    return this.indexDue([video], now);
  }

  private async indexDue(
    due: Array<Pick<Video, 'id' | 'userId'>>,
    now: Date,
  ): Promise<{ published: number }> {
    if (!due.length) return { published: 0 };

    for (const video of due) {
      await this.videoRepository.update(video.id, { indexedAt: now });
      await this.videosService.bustVideoDetailCache(video.id);
      await this.clearPending(video.id);
      this.eventEmitter.emit('video.published', {
        videoId: video.id,
        userId: video.userId,
      });
    }

    this.logger.log(`Scheduled publish: indexed ${due.length} video(s) past their schedule`);
    return { published: due.length };
  }

  private async clearPending(videoId: string): Promise<void> {
    try {
      await this.redis.srem(SCHEDULED_PUBLISH_PENDING_KEY, videoId);
    } catch {
      // non-fatal
    }
  }
}
