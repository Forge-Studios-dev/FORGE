import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { CommunityMember, CommunityMemberStatus } from './entities/community-member.entity';
import { Community } from './entities/community.entity';
import { User } from '../users/entities/user.entity';

/**
 * Fans out community-wide activity notifications to active members.
 *
 * Scope is intentionally limited to low-frequency, broadcast-worthy events
 * (e.g. a new community event). High-frequency signals such as individual room
 * chat messages and regular posts are deliberately NOT fanned out here to avoid
 * notification spam and request-path load — announcements have their own
 * dedicated async worker path (CommunityAnnouncementNotifyService).
 *
 * Listeners are invoked off the request path (EventEmitter2 does not await async
 * handlers), and member fan-out is paginated + batched to scale beyond a single
 * page of members.
 */
@Injectable()
export class CommunityActivityNotifyListener {
  private readonly logger = new Logger(CommunityActivityNotifyListener.name);

  private static readonly MEMBER_PAGE_SIZE = 1000;

  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectRepository(CommunityMember)
    private readonly memberRepository: Repository<CommunityMember>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @OnEvent('community.event.created')
  async onEventCreated(payload: { communityId: string; eventId: string; creatorId?: string }) {
    const linkMeta = await this.resolveLinkMetadata(payload.communityId, payload.creatorId);
    await this.notifyActiveMembers(payload.communityId, {
      type: NotificationType.COMMUNITY_POST_NEW,
      title: 'New community event',
      body: 'A new event was scheduled in your community.',
      metadata: {
        communityId: payload.communityId,
        eventId: payload.eventId,
        kind: 'event',
        ...linkMeta,
      },
      excludeUserId: payload.creatorId,
    });
  }

  private async resolveLinkMetadata(
    communityId: string,
    creatorIdHint?: string,
  ): Promise<Record<string, string>> {
    const community = await this.communityRepository.findOne({
      where: { id: communityId },
      select: { id: true, slug: true, creatorId: true },
    });
    const creatorId = creatorIdHint ?? community?.creatorId;
    const out: Record<string, string> = {};
    if (creatorId) out.creatorId = creatorId;
    if (community?.slug) out.slug = community.slug;
    if (creatorId) {
      const creator = await this.userRepository.findOne({
        where: { id: creatorId },
        select: { id: true, username: true },
      });
      if (creator?.username) out.username = creator.username;
    }
    return out;
  }

  /**
   * Notify every active member of a community, paginating through the roster in
   * stable-ordered chunks so large communities do not load all members at once.
   * `createMany` further chunks the inserts internally.
   */
  private async notifyActiveMembers(
    communityId: string,
    input: {
      type: NotificationType;
      title: string;
      body: string;
      metadata: Record<string, string>;
      excludeUserId?: string;
    },
  ): Promise<void> {
    try {
      const pageSize = CommunityActivityNotifyListener.MEMBER_PAGE_SIZE;
      let skip = 0;
      for (;;) {
        const members = await this.memberRepository.find({
          where: {
            communityId,
            status: CommunityMemberStatus.ACTIVE,
            ...(input.excludeUserId ? { userId: Not(input.excludeUserId) } : {}),
          },
          select: { id: true, userId: true },
          order: { id: 'ASC' },
          skip,
          take: pageSize,
        });
        if (!members.length) break;

        await this.notificationsService.createMany(
          members.map((m) => ({
            userId: m.userId,
            type: input.type,
            title: input.title,
            body: input.body,
            metadata: input.metadata,
          })),
        );

        if (members.length < pageSize) break;
        skip += pageSize;
      }
    } catch (err) {
      this.logger.warn(`Community activity notify failed for ${communityId}: ${String(err)}`);
    }
  }
}
