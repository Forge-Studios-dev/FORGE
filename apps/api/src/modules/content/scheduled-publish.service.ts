import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import {
  ModerationStatus,
  PublishStatus,
  Video,
  VideoStatus,
  VideoVisibility,
} from './entities/video.entity';
import { VideosService } from './videos.service';

/**
 * Closes the gap where `scheduledPublishAt` only gated discovery via
 * query-time filtering: `indexedAt` was set at transcode-ready time based on
 * whether the schedule had *already* passed, and nothing ever revisited it —
 * so a video scheduled for the future stayed permanently un-indexed (never
 * appeared in feed/search) once ready, unless a creator happened to edit it
 * again after the scheduled time. Primary path is a delayed Bull job at
 * `scheduledPublishAt`; a 15-minute backup scan catches missed jobs.
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
  ) {}

  async runScheduledPublish(): Promise<{ published: number }> {
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
    if (!video) return { published: 0 };
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
      this.eventEmitter.emit('video.published', {
        videoId: video.id,
        userId: video.userId,
      });
    }

    this.logger.log(`Scheduled publish: indexed ${due.length} video(s) past their schedule`);
    return { published: due.length };
  }
}