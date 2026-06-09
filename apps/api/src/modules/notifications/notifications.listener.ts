import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { PushDispatchService } from './push-dispatch.service';
import { NotificationType } from './entities/notification.entity';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { Follow } from '../engagement/entities/follow.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { VideoVisibility } from '../content/entities/video.entity';
import { StreamVisibility } from '../streaming/entities/stream.entity';
import { PremiumContentNotifyService } from './premium-content-notify.service';

/** Max in-app + push recipients per fan-out event (matches follower query cap). */
const FANOUT_RECIPIENT_LIMIT = 1000;

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushDispatch: PushDispatchService,
    private readonly mailService: MailService,
    private readonly entitlementsService: EntitlementsService,
    private readonly premiumContentNotify: PremiumContentNotifyService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
  ) {}

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
  async onVideoReady(payload: { videoId: string; userId: string }) {
    await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.VIDEO_READY,
      title: 'Your video is ready',
      body: 'Your upload has finished processing.',
      metadata: { videoId: payload.videoId },
    });
    await this.pushDispatch.enqueueForUser(payload.userId, {
      title: 'Your video is ready',
      body: 'Your upload has finished processing.',
      data: { type: 'video_ready', videoId: payload.videoId },
    });
    await this.maybeEmailUser(
      payload.userId,
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
      select: ['followerId'],
      take: 500,
    });
    const title = payload.creatorName
      ? `${payload.creatorName} goes live soon`
      : 'A creator you follow goes live soon';
    const body = payload.title || 'Live session starting soon';

    const recipientIds = [
      ...new Set([
        ...followers.map((f) => f.followerId),
        ...(payload.rsvpUserIds ?? []),
      ]),
    ];

    await this.pushDispatch.enqueueForUsers(recipientIds, {
      title,
      body,
      data: { type: 'stream_reminder', streamId: payload.streamId },
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
    });
    await this.maybeEmailUser(
      payload.userId,
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
    const creatorName = creator?.displayName ?? 'Someone you follow';

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
        take: FANOUT_RECIPIENT_LIMIT,
      });
      recipientIds = followers.map((f) => f.followerId);
    }

    if (!recipientIds.length) return;

    const title = `${creatorName} is live`;
    const body = payload.title || 'Join the live stream now.';
    const metadata = { streamId: payload.streamId, creatorId: payload.userId };
    const pushData = {
      type: 'stream_started_followed',
      streamId: payload.streamId,
      creatorId: payload.userId,
    };

    await this.notificationsService.createMany(
      recipientIds.map((userId) => ({
        userId,
        type: NotificationType.STREAM_STARTED_FOLLOWED,
        title,
        body,
        metadata,
      })),
    );
    await this.pushDispatch.enqueueForUsers(recipientIds, { title, body, data: pushData });
  }

  private async maybeEmailUser(userId: string, subject: string, body: string) {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user?.email) return;
      await this.mailService.sendMail(user.email, subject, body);
    } catch (e) {
      this.logger.warn(`Optional email notification failed: ${(e as Error).message}`);
    }
  }
}
