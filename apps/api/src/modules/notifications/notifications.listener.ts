import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { PushDispatchService } from './push-dispatch.service';
import { NotificationType } from './entities/notification.entity';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushDispatch: PushDispatchService,
    private readonly mailService: MailService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
