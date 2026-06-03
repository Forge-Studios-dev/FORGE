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

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushDispatch: PushDispatchService,
    private readonly mailService: MailService,
    private readonly entitlementsService: EntitlementsService,
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

  @OnEvent('stream.started')
  async onStreamStarted(payload: { streamId: string; userId: string; title: string }) {
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

    await this.notifyFollowersOfLive(payload);
  }

  @OnEvent('premium.content.new')
  async onPremiumContentNew(payload: {
    videoId: string;
    creatorId: string;
    visibility: VideoVisibility;
    title: string;
  }) {
    if (
      payload.visibility !== VideoVisibility.SUBSCRIBERS &&
      payload.visibility !== VideoVisibility.TIER
    ) {
      return;
    }

    const creator = await this.userRepository.findOne({ where: { id: payload.creatorId } });
    const creatorName = creator?.displayName ?? 'A creator you follow';

    const followers = await this.followRepository.find({
      where: { followingId: payload.creatorId },
      take: 500,
    });

    for (const follow of followers) {
      const hasSub = await this.entitlementsService.hasActiveSubscription(
        follow.followerId,
        payload.creatorId,
      );
      if (!hasSub) continue;

      await this.notificationsService.create({
        userId: follow.followerId,
        type: NotificationType.PREMIUM_CONTENT_NEW,
        title: 'New premium video',
        body: `${creatorName} uploaded: ${payload.title}`,
        metadata: { videoId: payload.videoId, creatorId: payload.creatorId },
      });
      await this.pushDispatch.enqueueForUser(follow.followerId, {
        title: 'New premium video',
        body: `${creatorName}: ${payload.title}`,
        data: {
          type: 'premium_content_new',
          videoId: payload.videoId,
          creatorId: payload.creatorId,
        },
      });
    }
  }

  private async notifyFollowersOfLive(payload: { streamId: string; userId: string; title: string }) {
    const creator = await this.userRepository.findOne({ where: { id: payload.userId } });
    const creatorName = creator?.displayName ?? 'Someone you follow';

    const followers = await this.followRepository.find({
      where: { followingId: payload.userId },
      take: 1000,
    });

    for (const follow of followers) {
      await this.notificationsService.create({
        userId: follow.followerId,
        type: NotificationType.STREAM_STARTED_FOLLOWED,
        title: `${creatorName} is live`,
        body: payload.title || 'Join the live stream now.',
        metadata: { streamId: payload.streamId, creatorId: payload.userId },
      });
      await this.pushDispatch.enqueueForUser(follow.followerId, {
        title: `${creatorName} is live`,
        body: payload.title || 'Join the live stream now.',
        data: {
          type: 'stream_started_followed',
          streamId: payload.streamId,
          creatorId: payload.userId,
        },
      });
    }
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
