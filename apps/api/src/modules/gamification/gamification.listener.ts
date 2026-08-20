import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { isSkillEconomyLmsEnabled } from '../../common/features/skill-economy-lms';
import { GamificationService, PlatformXpAction } from './gamification.service';

type CommunityActivityPayload = {
  userId: string;
  communityId: string;
  xp: number;
  source: string;
};

@Injectable()
export class GamificationListener {
  private readonly logger = new Logger(GamificationListener.name);

  constructor(private readonly gamificationService: GamificationService) {}

  @OnEvent('community.activity', { async: true })
  async onCommunityActivity(payload: CommunityActivityPayload): Promise<void> {
    if (!isSkillEconomyLmsEnabled()) return;
    if (!payload.userId || !payload.communityId || !payload.xp) return;
    try {
      await this.gamificationService.awardXp(
        payload.userId,
        payload.communityId,
        payload.xp,
        payload.source,
      );
    } catch (err) {
      this.logger.warn(
        `XP award failed (${payload.source}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async awardPlatformXpSafe(userId: string, action: PlatformXpAction): Promise<void> {
    if (!isSkillEconomyLmsEnabled()) return;
    if (!userId) return;
    try {
      await this.gamificationService.awardPlatformXp(userId, action);
    } catch (err) {
      this.logger.warn(
        `Platform XP award failed (${action}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  @OnEvent('video.ready', { async: true })
  async onVideoReady(payload: { userId: string }): Promise<void> {
    await this.awardPlatformXpSafe(payload.userId, PlatformXpAction.VIDEO_UPLOAD);
  }

  @OnEvent('comment.created', { async: true })
  async onCommentCreated(payload: { comment: { userId: string } }): Promise<void> {
    await this.awardPlatformXpSafe(payload.comment?.userId, PlatformXpAction.COMMENT_CREATE);
  }

  @OnEvent('stream.viewer.joined', { async: true })
  async onStreamViewerJoined(payload: { userId: string }): Promise<void> {
    await this.awardPlatformXpSafe(payload.userId, PlatformXpAction.LIVE_ATTEND);
  }

  @OnEvent('course.published', { async: true })
  async onCoursePublished(payload: { creatorId: string }): Promise<void> {
    await this.awardPlatformXpSafe(payload.creatorId, PlatformXpAction.COURSE_PUBLISH);
  }

  @OnEvent('course.lesson.completed', { async: true })
  async onLessonCompleted(payload: { userId: string }): Promise<void> {
    await this.awardPlatformXpSafe(payload.userId, PlatformXpAction.LESSON_COMPLETE);
  }
}
