import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { PushDispatchService } from './push-dispatch.service';
import { NotificationType } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { VideoVisibility } from '../content/entities/video.entity';

const FANOUT_RECIPIENT_LIMIT = 1000;

export type PremiumContentNotifyPayload = {
  videoId: string;
  creatorId: string;
  visibility: VideoVisibility | string;
  requiredTierId?: string | null;
  title: string;
};

@Injectable()
export class PremiumContentNotifyService {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushDispatch: PushDispatchService,
    private readonly entitlementsService: EntitlementsService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async fanOut(payload: PremiumContentNotifyPayload): Promise<void> {
    if (
      payload.visibility !== VideoVisibility.SUBSCRIBERS &&
      payload.visibility !== VideoVisibility.TIER
    ) {
      return;
    }

    const creator = await this.userRepository.findOne({ where: { id: payload.creatorId } });
    const creatorName = creator?.displayName ?? 'A channel you\'re subscribed to';

    const subscriberIds = (
      await this.entitlementsService.listActiveSubscriberUserIds(
        payload.creatorId,
        payload.visibility === VideoVisibility.TIER ? payload.requiredTierId : null,
      )
    ).slice(0, FANOUT_RECIPIENT_LIMIT);

    if (!subscriberIds.length) return;

    const notifTitle = 'New premium video';
    const notifBody = `${creatorName} uploaded: ${payload.title}`;
    const pushBody = `${creatorName}: ${payload.title}`;
    const metadata = { videoId: payload.videoId, creatorId: payload.creatorId };
    const pushData = {
      type: 'premium_content_new',
      videoId: payload.videoId,
      creatorId: payload.creatorId,
    };

    await this.notificationsService.createMany(
      subscriberIds.map((userId) => ({
        userId,
        type: NotificationType.PREMIUM_CONTENT_NEW,
        title: notifTitle,
        body: notifBody,
        metadata,
      })),
    );
    await this.pushDispatch.enqueueForUsers(subscriberIds, {
      title: notifTitle,
      body: pushBody,
      data: pushData,
    });
  }
}
