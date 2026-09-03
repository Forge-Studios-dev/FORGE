import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { categoryForNotificationType, isCategoryMuted } from '@forge/shared-types';
import { isSkillEconomyLmsEnabled } from '../../common/features/skill-economy-lms';
import { NotificationsService } from './notifications.service';
import { PushDispatchService } from './push-dispatch.service';
import { NotificationType } from './entities/notification.entity';
import { MailService } from '../mail/mail.service';
import { User, UserRole } from '../users/entities/user.entity';
import { Follow, FollowNotifyLevel } from '../engagement/entities/follow.entity';
import { Comment } from '../engagement/entities/comment.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { VideoVisibility } from '../content/entities/video.entity';
import { StreamVisibility } from '../streaming/entities/stream.entity';
import { PremiumContentNotifyService } from './premium-content-notify.service';
import { recipientIdsForNotifyLevel } from './notify-recipients.util';
import { EngagementService } from '../engagement/engagement.service';

/** Max in-app + push recipients per fan-out event (matches follower query cap). */
const FANOUT_RECIPIENT_LIMIT = 1000;
/** Recent watch window for “Personalized” bell (YouTube-like engagement gate). */
const PERSONALIZED_ENGAGEMENT_DAYS = 45;

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushDispatch: PushDispatchService,
    private readonly mailService: MailService,
    private readonly entitlementsService: EntitlementsService,
    private readonly premiumContentNotify: PremiumContentNotifyService,
    private readonly engagementService: EngagementService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(WatchHistory)
    private readonly watchHistoryRepository: Repository<WatchHistory>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /**
   * Followers who recently watched this creator’s videos qualify for Personalized bell.
   */
  private async engagedFollowerIds(
    creatorId: string,
    candidateIds: string[],
  ): Promise<Set<string>> {
    if (!candidateIds.length) return new Set();
    const since = new Date(
      Date.now() - PERSONALIZED_ENGAGEMENT_DAYS * 24 * 60 * 60 * 1000,
    );
    const rows = await this.watchHistoryRepository
      .createQueryBuilder('wh')
      .innerJoin('wh.video', 'v')
      .select('wh.userId', 'userId')
      .distinct(true)
      .where('v.user_id = :creatorId', { creatorId })
      .andWhere('wh.user_id IN (:...candidateIds)', { candidateIds })
      .andWhere('wh.watched_at >= :since', { since })
      .getRawMany<{ userId: string }>();
    return new Set(rows.map((r) => r.userId).filter(Boolean));
  }

  private async recipientIdsFromFollowers(
    creatorId: string,
    followers: Array<{ followerId: string; notifyLevel: FollowNotifyLevel }>,
  ): Promise<string[]> {
    const personalizedIds = followers
      .filter((f) => f.notifyLevel === FollowNotifyLevel.PERSONALIZED)
      .map((f) => f.followerId);
    const engaged = await this.engagedFollowerIds(creatorId, personalizedIds);
    return recipientIdsForNotifyLevel(followers, engaged);
  }

  @OnEvent('creator.approved')
  async onCreatorApproved(payload: { userId: string }) {
    await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.CREATOR_APPROVED,
      title: 'Creator access approved',
      body: 'You can now upload videos and go live.',
    });
    await this.pushDispatch.enqueueForUser(payload.userId, {
      title: 'Creator access approved',
      body: 'You can now upload videos and go live.',
      data: { type: 'creator_approved' },
      category: categoryForNotificationType(NotificationType.CREATOR_APPROVED),
    });
  }

  @OnEvent('creator.rejected')
  onCreatorRejected(payload: { userId: string; note?: string | null }) {
    return this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.CREATOR_REJECTED,
      title: 'Creator request rejected',
      body: payload.note ?? 'Your creator request was rejected.',
      metadata: payload.note ? { note: payload.note } : null,
    });
  }

  @OnEvent('video.ready')
  async onVideoReady(payload: {
    videoId: string;
    userId: string;
    videoType?: string | null;
  }) {
    await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.VIDEO_READY,
      title: 'Your video is ready',
      body: 'Your upload has finished processing.',
      metadata: {
        videoId: payload.videoId,
        ...(payload.videoType ? { videoType: payload.videoType } : {}),
      },
    });
    await this.pushDispatch.enqueueForUser(payload.userId, {
      title: 'Your video is ready',
      body: 'Your upload has finished processing.',
      data: {
        type: 'video_ready',
        videoId: payload.videoId,
        ...(payload.videoType ? { videoType: payload.videoType } : {}),
      },
      category: categoryForNotificationType(NotificationType.VIDEO_READY),
    });
    await this.maybeEmailUser(
      payload.userId,
      NotificationType.VIDEO_READY,
      'Your FORGE video is ready',
      `Video processing finished. Video ID: ${payload.videoId}`,
    );
  }

  @OnEvent('stream.reminder')
  async onStreamReminder(payload: {
    streamId: string;
    userId: string;
    title: string;
    scheduledAt?: Date | null;
    creatorName?: string;
    rsvpUserIds?: string[];
  }) {
    const followers = await this.followRepository.find({
      where: { followingId: payload.userId },
      select: ['followerId', 'notifyLevel'],
      take: 500,
    });
    const title = payload.creatorName
      ? `${payload.creatorName} goes live soon`
      : 'A channel you\'re subscribed to goes live soon';
    const body = payload.title || 'Live session starting soon';

    const fromFollows = await this.recipientIdsFromFollowers(payload.userId, followers);
    const recipientIds = [...new Set([...fromFollows, ...(payload.rsvpUserIds ?? [])])].slice(
      0,
      FANOUT_RECIPIENT_LIMIT,
    );
    if (!recipientIds.length) return;

    const blockedPeers = new Set(await this.engagementService.getBlockedPeerIds(payload.userId));
    const filteredRecipients =
      blockedPeers.size === 0 ? recipientIds : recipientIds.filter((id) => !blockedPeers.has(id));
    if (!filteredRecipients.length) return;

    await this.pushDispatch.enqueueForUsers(filteredRecipients, {
      title,
      body,
      data: { type: 'stream_reminder', streamId: payload.streamId },
      category: 'live',
    });
  }

  @OnEvent('stream.started')
  async onStreamStarted(payload: {
    streamId: string;
    userId: string;
    title: string;
    visibility?: StreamVisibility;
    requiredTierId?: string | null;
  }) {
    const body = payload.title ? `Stream started: ${payload.title}` : 'Your live stream started.';
    await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.STREAM_STARTED,
      title: 'You are live',
      body,
      metadata: { streamId: payload.streamId },
    });
    await this.pushDispatch.enqueueForUser(payload.userId, {
      title: 'You are live',
      body,
      data: { type: 'stream_started', streamId: payload.streamId },
      category: categoryForNotificationType(NotificationType.STREAM_STARTED),
    });
    await this.maybeEmailUser(
      payload.userId,
      NotificationType.STREAM_STARTED,
      'You are live on FORGE',
      payload.title ? `Stream started: ${payload.title}` : 'Your live stream started.',
    );

    await this.notifyAudienceOfLive(payload);
  }

  @OnEvent('premium.content.new')
  async onPremiumContentNew(payload: {
    videoId: string;
    creatorId: string;
    visibility: VideoVisibility;
    requiredTierId?: string | null;
    title: string;
  }) {
    await this.premiumContentNotify.fanOut(payload);
  }

  @OnEvent('follow.created')
  async onFollowCreated(payload: { followerId: string; followingId: string }) {
    if (payload.followerId === payload.followingId) return;
    if (await this.engagementService.isBlockedEitherWay(payload.followerId, payload.followingId)) {
      return;
    }

    const follower = await this.userRepository.findOne({ where: { id: payload.followerId } });
    const name = follower?.displayName ?? 'Someone';

    await this.notificationsService.create({
      userId: payload.followingId,
      type: NotificationType.NEW_FOLLOWER,
      title: 'New subscriber',
      body: `${name} subscribed to your channel`,
      metadata: { followerId: payload.followerId, followerUsername: follower?.username },
    });
    await this.pushDispatch.enqueueForUser(payload.followingId, {
      title: 'New subscriber',
      body: `${name} subscribed to your channel`,
      data: {
        type: 'new_follower',
        followerId: payload.followerId,
        ...(follower?.username ? { followerUsername: follower.username } : {}),
      },
      category: categoryForNotificationType(NotificationType.NEW_FOLLOWER),
    });
  }

  @OnEvent('comment.created')
  async onCommentCreated(payload: {
    videoId: string;
    comment: Comment;
    videoOwnerId: string;
  }) {
    const comment = payload.comment;
    const author = comment.user?.displayName ?? 'Someone';

    if (comment.parentId) {
      const parent = await this.commentRepository.findOne({
        where: { id: comment.parentId },
        relations: ['user'],
      });
      if (parent && parent.userId !== comment.userId) {
        await this.notificationsService.create({
          userId: parent.userId,
          type: NotificationType.COMMENT_REPLY,
          title: 'New reply',
          body: `${author} replied to your comment`,
          metadata: { videoId: payload.videoId, commentId: comment.id },
        });
        await this.pushDispatch.enqueueForUser(parent.userId, {
          title: 'New reply',
          body: `${author} replied to your comment`,
          data: { type: 'comment_reply', videoId: payload.videoId, commentId: comment.id },
          category: categoryForNotificationType(NotificationType.COMMENT_REPLY),
        });
      }
    } else if (payload.videoOwnerId !== comment.userId) {
      await this.notificationsService.create({
        userId: payload.videoOwnerId,
        type: NotificationType.COMMENT_ON_VIDEO,
        title: 'New comment',
        body: `${author} commented on your video`,
        metadata: { videoId: payload.videoId, commentId: comment.id },
      });
      await this.pushDispatch.enqueueForUser(payload.videoOwnerId, {
        title: 'New comment',
        body: `${author} commented on your video`,
        data: { type: 'comment_on_video', videoId: payload.videoId, commentId: comment.id },
        category: categoryForNotificationType(NotificationType.COMMENT_ON_VIDEO),
      });
    }
  }

  @OnEvent('video.liked')
  async onVideoLiked(payload: { videoId: string; videoOwnerId: string; likerId: string }) {
    if (payload.videoOwnerId === payload.likerId) return;

    const dedupeKey = `notif:like:${payload.videoId}:${payload.likerId}`;
    const ok = await this.redis.set(dedupeKey, '1', 'EX', 3600, 'NX');
    if (ok !== 'OK') return;

    const liker = await this.userRepository.findOne({ where: { id: payload.likerId } });
    const name = liker?.displayName ?? 'Someone';

    await this.notificationsService.create({
      userId: payload.videoOwnerId,
      type: NotificationType.VIDEO_LIKED,
      title: 'New like',
      body: `${name} liked your video`,
      metadata: { videoId: payload.videoId, likerId: payload.likerId },
    });
  }

  private async notifyAudienceOfLive(payload: {
    streamId: string;
    userId: string;
    title: string;
    visibility?: StreamVisibility;
    requiredTierId?: string | null;
  }) {
    const visibility = payload.visibility ?? StreamVisibility.PUBLIC;

    if (
      visibility === StreamVisibility.PRIVATE ||
      visibility === StreamVisibility.PAID_EVENT
    ) {
      return;
    }

    const creator = await this.userRepository.findOne({ where: { id: payload.userId } });
    const creatorName = creator?.displayName ?? 'Someone you\'re subscribed to';

    let recipientIds: string[];

    if (
      visibility === StreamVisibility.SUBSCRIBERS ||
      visibility === StreamVisibility.TIER
    ) {
      recipientIds = (
        await this.entitlementsService.listActiveSubscriberUserIds(
          payload.userId,
          visibility === StreamVisibility.TIER ? payload.requiredTierId : null,
        )
      ).slice(0, FANOUT_RECIPIENT_LIMIT);
    } else {
      const followers = await this.followRepository.find({
        where: { followingId: payload.userId },
        select: ['followerId', 'notifyLevel'],
        take: FANOUT_RECIPIENT_LIMIT,
      });
      recipientIds = (
        await this.recipientIdsFromFollowers(payload.userId, followers)
      ).slice(0, FANOUT_RECIPIENT_LIMIT);
    }

    if (!recipientIds.length) return;

    const blockedPeers = new Set(
      await this.engagementService.getBlockedPeerIds(payload.userId),
    );
    const filteredRecipients =
      blockedPeers.size === 0
        ? recipientIds
        : recipientIds.filter((id) => !blockedPeers.has(id));

    if (!filteredRecipients.length) return;

    const title = `${creatorName} is live`;
    const body = payload.title || 'Join the live stream now.';
    const metadata = { streamId: payload.streamId, creatorId: payload.userId };
    const pushData = {
      type: 'stream_started_followed',
      streamId: payload.streamId,
      creatorId: payload.userId,
    };

    await this.notificationsService.createMany(
      filteredRecipients.map((userId) => ({
        userId,
        type: NotificationType.STREAM_STARTED_FOLLOWED,
        title,
        body,
        metadata,
      })),
    );
    await this.pushDispatch.enqueueForUsers(filteredRecipients, {
      title,
      body,
      data: pushData,
      category: categoryForNotificationType(NotificationType.STREAM_STARTED_FOLLOWED),
    });
  }

  @OnEvent('video.super-thanks.paid', { async: true })
  async onSuperThanksPaid(payload: {
    videoId: string;
    creatorId: string;
    userId: string;
    body: string;
    amountCents: number;
  }) {
    if (payload.creatorId === payload.userId) return;
    const tipper = await this.userRepository.findOne({ where: { id: payload.userId } });
    const name = tipper?.displayName ?? 'Someone';
    const dollars = (payload.amountCents / 100).toFixed(2);
    const note = payload.body?.trim() ? `: “${payload.body.trim().slice(0, 80)}”` : '';
    const title = 'Super Thanks';
    const body = `${name} sent $${dollars}${note}`;

    await this.notificationsService.create({
      userId: payload.creatorId,
      type: NotificationType.SUPER_THANKS,
      title,
      body,
      metadata: {
        videoId: payload.videoId,
        tipperId: payload.userId,
        amountCents: payload.amountCents,
      },
    });
    await this.pushDispatch.enqueueForUser(payload.creatorId, {
      title,
      body,
      data: {
        type: 'super_thanks',
        videoId: payload.videoId,
        tipperId: payload.userId,
      },
      category: categoryForNotificationType(NotificationType.SUPER_THANKS),
    });
  }

  @OnEvent('gamification.achievement_unlocked', { async: true })
  async onAchievementUnlocked(payload: {
    userId: string;
    key: string;
    title: string;
    icon: string;
  }) {
    if (!isSkillEconomyLmsEnabled()) return;
    const notifTitle = `${payload.icon} Achievement unlocked: ${payload.title}`;
    await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.ACHIEVEMENT_UNLOCKED,
      title: notifTitle,
      body: null,
      metadata: { key: payload.key },
    });
    await this.pushDispatch.enqueueForUser(payload.userId, {
      title: notifTitle,
      body: '',
      data: { type: 'achievement_unlocked', key: payload.key },
      category: categoryForNotificationType(NotificationType.ACHIEVEMENT_UNLOCKED),
    });
  }

  @OnEvent('gamification.level_up', { async: true })
  async onXpLevelUp(payload: { userId: string; level: number; xp: number }) {
    if (!isSkillEconomyLmsEnabled()) return;
    const notifTitle = `Level up! You reached Level ${payload.level}`;
    await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.XP_LEVEL_UP,
      title: notifTitle,
      body: `You now have ${payload.xp} total XP.`,
      metadata: { level: payload.level, xp: payload.xp },
    });
    await this.pushDispatch.enqueueForUser(payload.userId, {
      title: notifTitle,
      body: `${payload.xp} XP total`,
      data: { type: 'xp_level_up', level: String(payload.level) },
      category: categoryForNotificationType(NotificationType.XP_LEVEL_UP),
    });
  }

  @OnEvent('copyright.takedown_issued')
  async onCopyrightTakedown(payload: { videoId: string; userId: string; noticeId: string }) {
    const title = 'Your video was taken down (copyright claim)';
    const body = 'A copyright owner claimed this video. You can file a counter-notice if you believe this is a mistake.';
    await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.COPYRIGHT_TAKEDOWN,
      title,
      body,
      metadata: { videoId: payload.videoId, noticeId: payload.noticeId },
    });
    await this.pushDispatch.enqueueForUser(payload.userId, {
      title,
      body,
      data: { type: 'copyright_takedown', videoId: payload.videoId, noticeId: payload.noticeId },
      category: categoryForNotificationType(NotificationType.COPYRIGHT_TAKEDOWN),
    });
    await this.maybeEmailUser(payload.userId, NotificationType.COPYRIGHT_TAKEDOWN, title, body);
  }

  @OnEvent('copyright.video_reinstated')
  async onCopyrightVideoReinstated(payload: { videoId: string; userId: string; noticeId: string }) {
    const title = 'Your video was reinstated';
    const body = 'The copyright claim against your video was resolved in your favor.';
    await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.COPYRIGHT_VIDEO_REINSTATED,
      title,
      body,
      metadata: { videoId: payload.videoId, noticeId: payload.noticeId },
    });
    await this.pushDispatch.enqueueForUser(payload.userId, {
      title,
      body,
      data: { type: 'copyright_video_reinstated', videoId: payload.videoId },
      category: categoryForNotificationType(NotificationType.COPYRIGHT_VIDEO_REINSTATED),
    });
  }

  @OnEvent('account.strike_issued')
  async onStrikeIssued(payload: {
    userId: string;
    strikeId: string;
    type: string;
    strikeNumber: number;
    consequence: string;
  }) {
    const kind = payload.type === 'copyright' ? 'copyright' : 'community guideline';
    const title = `Strike ${payload.strikeNumber}: ${kind} violation`;
    const body =
      payload.consequence === 'termination_recommended'
        ? 'Your channel is under review for termination after a third strike.'
        : payload.consequence === 'upload_restriction_2w'
          ? "You can't upload for 2 weeks as a result of this strike."
          : 'This is a warning — no restriction yet, but further strikes escalate.';
    await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.STRIKE_ISSUED,
      title,
      body,
      metadata: { strikeId: payload.strikeId },
    });
    await this.pushDispatch.enqueueForUser(payload.userId, {
      title,
      body,
      data: { type: 'strike_issued', strikeId: payload.strikeId },
      category: categoryForNotificationType(NotificationType.STRIKE_ISSUED),
    });
    await this.maybeEmailUser(payload.userId, NotificationType.STRIKE_ISSUED, title, body);
  }

  @OnEvent('account.strike_rescinded')
  async onStrikeRescinded(payload: { userId: string; strikeId: string; reason: string }) {
    const title = 'A strike on your account was rescinded';
    await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.STRIKE_RESCINDED,
      title,
      body: payload.reason,
      metadata: { strikeId: payload.strikeId },
    });
    await this.pushDispatch.enqueueForUser(payload.userId, {
      title,
      body: payload.reason,
      data: { type: 'strike_rescinded', strikeId: payload.strikeId },
      category: categoryForNotificationType(NotificationType.STRIKE_RESCINDED),
    });
  }

  @OnEvent('account.strike_appeal_resolved')
  async onStrikeAppealResolved(payload: { userId: string; strikeId: string; granted: boolean }) {
    const title = payload.granted ? 'Your strike appeal was granted' : 'Your strike appeal was denied';
    const body = payload.granted
      ? 'The strike has been removed from your account.'
      : 'The strike remains on your account.';
    await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.STRIKE_APPEAL_RESOLVED,
      title,
      body,
      metadata: { strikeId: payload.strikeId, granted: payload.granted },
    });
    await this.pushDispatch.enqueueForUser(payload.userId, {
      title,
      body,
      data: { type: 'strike_appeal_resolved', strikeId: payload.strikeId },
      category: categoryForNotificationType(NotificationType.STRIKE_APPEAL_RESOLVED),
    });
  }

  @OnEvent('video.content_scan_held')
  async onContentScanHeld(payload: {
    videoId: string;
    userId: string;
    moderationStatus?: string;
    categories?: string[];
    provider?: string;
  }) {
    const admins = await this.userRepository.find({
      where: { role: UserRole.ADMIN },
      select: { id: true },
      take: 25,
    });
    const title = 'Upload held for safety review';
    const body = 'A video was held by content scanning and needs review in Admin → Content.';
    for (const admin of admins) {
      await this.notificationsService.create({
        userId: admin.id,
        type: NotificationType.CONTENT_SCAN_HELD,
        title,
        body,
        metadata: {
          videoId: payload.videoId,
          uploaderId: payload.userId,
          moderationStatus: payload.moderationStatus ?? 'held',
          categories: payload.categories ?? [],
          provider: payload.provider ?? null,
        },
      });
      await this.pushDispatch.enqueueForUser(admin.id, {
        title,
        body,
        data: { type: 'content_scan_held', videoId: payload.videoId },
        category: categoryForNotificationType(NotificationType.CONTENT_SCAN_HELD),
      });
    }
  }

  private async maybeEmailUser(
    userId: string,
    type: NotificationType,
    subject: string,
    body: string,
  ) {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: { id: true, email: true, notificationPreferences: true },
      });
      if (!user?.email) return;
      if (isCategoryMuted(user.notificationPreferences, categoryForNotificationType(type))) return;
      await this.mailService.sendMail(user.email, subject, body);
    } catch (e) {
      this.logger.warn(`Optional email notification failed: ${(e as Error).message}`);
    }
  }
}
