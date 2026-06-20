import { Injectable } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './entities/notification.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { CommunityPostType } from '../communities/entities/community-post.entity';
import type { CommunityAnnouncementNotifyJobData } from '../workers/community-announcement-notify/community-announcement-notify.constants';

const NOTIFY_CHUNK = 1000;

@Injectable()
export class CommunityAnnouncementNotifyService {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async fanOut(payload: CommunityAnnouncementNotifyJobData): Promise<void> {
    const title = payload.title.trim() || 'New announcement';
    const body = payload.body.trim().slice(0, 200);
    const metadata = {
      communityId: payload.communityId,
      postId: payload.postId,
      postType: CommunityPostType.ANNOUNCEMENT,
    };

    let offset = 0;
    for (;;) {
      const subs = await this.entitlementsService.listSubscribersForCreator(payload.creatorId, {
        limit: NOTIFY_CHUNK,
        offset,
      });
      if (!subs.length) break;

      await this.notificationsService.createMany(
        subs.map((s) => ({
          userId: s.userId,
          type: NotificationType.COMMUNITY_POST_NEW,
          title,
          body,
          metadata,
        })),
      );

      if (subs.length < NOTIFY_CHUNK) break;
      offset += NOTIFY_CHUNK;
    }
  }
}
