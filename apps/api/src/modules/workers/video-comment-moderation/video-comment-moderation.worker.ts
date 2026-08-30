import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  VIDEO_COMMENT_MODERATION_QUEUE,
  VideoCommentModerationJob,
} from './video-comment-moderation.constants';
import { VideoCommentModerationService } from './video-comment-moderation.service';

@Processor(VIDEO_COMMENT_MODERATION_QUEUE)
export class VideoCommentModerationWorker extends WorkerHost {
  private readonly logger = new Logger(VideoCommentModerationWorker.name);

  constructor(private readonly moderation: VideoCommentModerationService) {
    super();
  }

  async process(job: Job<VideoCommentModerationJob>): Promise<void> {
    this.logger.debug(`Rejudging held video comment ${job.data.commentId}`);
    await this.moderation.rejudgeHeldComment(job.data);
  }
}
