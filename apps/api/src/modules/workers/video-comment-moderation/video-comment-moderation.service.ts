import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { IsNull, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  VIDEO_COMMENT_MODERATION_QUEUE,
  VideoCommentModerationJob,
} from './video-comment-moderation.constants';
import { Comment, CommentModerationStatus } from '../../engagement/entities/comment.entity';
import { Video } from '../../content/entities/video.entity';
import { AiModerationService } from '../../communities/ai-moderation.service';

/**
 * Async LLM re-judge for regex-held video comments.
 * Clears false positives automatically; confirmed spam stays held for Studio/admin.
 */
@Injectable()
export class VideoCommentModerationService {
  private readonly logger = new Logger(VideoCommentModerationService.name);

  constructor(
    @InjectQueue(VIDEO_COMMENT_MODERATION_QUEUE)
    private readonly queue: Queue<VideoCommentModerationJob>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly aiModeration: AiModerationService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  enqueueRegexHeldReview(commentId: string, body: string): void {
    if (!this.configService.get<boolean>('ai.moderationLlmEnabled')) return;
    if (!this.configService.get<string>('openai.apiKey')?.trim()) return;

    void this.queue
      .add(
        'rejudge',
        { commentId, body },
        {
          jobId: `vcm:${commentId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 86400, count: 5000 },
          removeOnFail: { age: 7 * 86400, count: 1000 },
        },
      )
      .catch((err) => {
        this.logger.warn(
          `Failed to enqueue video comment rejudge ${commentId}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      });
  }

  async rejudgeHeldComment(job: VideoCommentModerationJob): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id: job.commentId, deletedAt: IsNull() },
      relations: ['user'],
    });
    if (!comment) return;
    if (comment.moderationStatus !== CommentModerationStatus.HELD) return;

    const verdict = await this.aiModeration.scoreWithOpenAiOnly(job.body);
    if (!verdict) {
      this.logger.debug(
        JSON.stringify({
          msg: 'video_comment_llm_unavailable_keep_held',
          commentId: job.commentId,
        }),
      );
      return;
    }

    if (verdict.flagged) {
      this.logger.log(
        JSON.stringify({
          msg: 'video_comment_llm_confirmed_held',
          commentId: job.commentId,
          score: verdict.score,
        }),
      );
      return;
    }

    // False positive — release to public and notify the video owner.
    comment.moderationStatus = CommentModerationStatus.NONE;
    comment.moderatedAt = new Date();
    const saved = await this.commentRepository.save(comment);

    const video = await this.videoRepository.findOne({
      where: { id: comment.videoId },
      select: { id: true, userId: true },
    });
    if (video) {
      this.eventEmitter.emit('comment.created', {
        videoId: comment.videoId,
        comment: saved,
        videoOwnerId: video.userId,
      });
    }

    this.logger.log(
      JSON.stringify({
        msg: 'video_comment_llm_auto_released',
        commentId: job.commentId,
        score: verdict.score,
      }),
    );
  }
}
