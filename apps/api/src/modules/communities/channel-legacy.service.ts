import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Community } from './entities/community.entity';
import { Channel } from './entities/channel.entity';
import { ChannelMember } from './entities/channel-member.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import {
  CreateChannelDto,
  InviteChannelMemberDto,
  SendChannelMessageDto,
  UpdateChannelDto,
} from './dto/community.dto';
import { toPublicChannel, toPublicChannelMessage } from './community.mapper';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AccessSessionsService } from '../access-sessions/access-sessions.service';
import { AccessSessionType } from '../access-sessions/dto/access-session.dto';
import { CommunityModerationService } from './community-moderation.service';
import { AiCommunityService } from './ai-community.service';
import { ChannelType } from '../entitlements/entities/channel-type.enum';
import { CommunityModerationQueueService } from './community-moderation-queue.service';
import { UserRole } from '../users/entities/user.entity';
import { ChannelMigrationService } from './channel-migration.service';
import { CommunityRoomMessagesService } from './community-room-messages.service';
import { FeatureFlagsService } from '../platform/feature-flags.service';
import {
  CHANNELS_DEPRECATED_FLAG,
  CHANNELS_MIGRATION_HINT,
} from './community-deprecation.constants';
import { CommunityAccessService } from './community-access.service';

/**
 * Legacy per-channel CRUD, invites, and messaging. Every mutation path is
 * behind the CHANNELS_DEPRECATED feature flag; reads/writes transparently
 * bridge to community rooms when a mapping exists (see ChannelMigrationService).
 *
 * Extracted from CommunitiesService (C2 in FRESH_AUDIT_2026-07-26 — god-object
 * split; H-A4 legacy channel isolation). Isolating these methods here makes
 * the whole file deletable once channels are fully removed. CommunitiesService
 * still exposes them as facade methods so existing controllers/callers work.
 *
 * @deprecated Use CommunityRoomsService / CommunityRoomMessagesService.
 */
@Injectable()
export class ChannelLegacyService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(ChannelMember)
    private readonly memberRepository: Repository<ChannelMember>,
    @InjectRepository(ChannelMessage)
    private readonly messageRepository: Repository<ChannelMessage>,
    private readonly entitlementsService: EntitlementsService,
    private readonly accessSessionsService: AccessSessionsService,
    @Inject(forwardRef(() => CommunityModerationService))
    private readonly moderationService: CommunityModerationService,
    private readonly aiCommunityService: AiCommunityService,
    private readonly moderationQueueService: CommunityModerationQueueService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
    private readonly channelMigrationService: ChannelMigrationService,
    @Inject(forwardRef(() => CommunityRoomMessagesService))
    private readonly roomMessagesService: CommunityRoomMessagesService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly accessService: CommunityAccessService,
  ) {}

  /**
   * Create a legacy channel. Caller must resolve the target community first;
   * CommunitiesService (the facade) does the resolution using either an
   * explicit communityId, dto.communityId, or ensureDefaultCommunity.
   */
  async createChannel(community: Community, dto: CreateChannelDto) {
    await this.assertChannelMutationsAllowed();

    const slug =
      dto.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') ||
      dto.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const existing = await this.channelRepository.findOne({
      where: { communityId: community.id, slug },
    });
    if (existing) throw new BadRequestException('Channel slug already exists');

    const channel = await this.channelRepository.save(
      this.channelRepository.create({
        communityId: community.id,
        name: dto.name.trim(),
        slug,
        type: dto.type ?? ChannelType.PUBLIC,
        requiredTierId: dto.requiredTierId ?? null,
        categoryId: dto.categoryId ?? null,
        sortOrder: dto.sortOrder ?? 99,
      }),
    );

    return toPublicChannel(channel);
  }

  async updateChannel(creatorId: string, channelId: string, dto: UpdateChannelDto) {
    await this.assertChannelMutationsAllowed();
    const channel = await this.getOwnedChannel(creatorId, channelId);
    if (dto.name !== undefined) channel.name = dto.name.trim();
    if (dto.type !== undefined) channel.type = dto.type;
    if (dto.requiredTierId !== undefined) channel.requiredTierId = dto.requiredTierId;
    if (dto.categoryId !== undefined) channel.categoryId = dto.categoryId;
    if (dto.sortOrder !== undefined) channel.sortOrder = dto.sortOrder;
    const saved = await this.channelRepository.save(channel);
    return toPublicChannel(saved);
  }

  async deleteChannel(creatorId: string, channelId: string) {
    await this.assertChannelMutationsAllowed();
    const channel = await this.getOwnedChannel(creatorId, channelId);
    await this.channelRepository.delete(channel.id);
    return { deleted: true, id: channel.id };
  }

  async reorderChannels(
    creatorId: string,
    community: Community,
    channelIds: string[],
  ) {
    await this.assertChannelMutationsAllowed();
    if (community.creatorId !== creatorId) {
      throw new ForbiddenException('Community not found or not owned');
    }
    const channels = await this.channelRepository.find({ where: { communityId: community.id } });
    const idSet = new Set(channelIds);
    if (idSet.size !== channelIds.length) {
      throw new BadRequestException('Duplicate channel ids');
    }
    for (const ch of channels) {
      if (!idSet.has(ch.id)) {
        throw new BadRequestException('channelIds must include all community channels');
      }
    }
    if (channelIds.length === 0) {
      return { reordered: true };
    }
    const caseSql = channelIds
      .map((id, index) => `WHEN id = $${index + 3}::uuid THEN ${index}`)
      .join(' ');
    await this.channelRepository.query(
      `UPDATE channels SET sort_order = CASE ${caseSql} END, updated_at = NOW()
       WHERE community_id = $1::uuid AND id = ANY($2::uuid[])`,
      [community.id, channelIds, ...channelIds],
    );
    return { reordered: true };
  }

  async inviteMember(creatorId: string, channelId: string, dto: InviteChannelMemberDto) {
    await this.assertChannelMutationsAllowed();
    const channel = await this.getOwnedChannel(creatorId, channelId);
    if (channel.type !== ChannelType.INVITE) {
      throw new BadRequestException('Channel is not invite-only');
    }
    await this.memberRepository.save(
      this.memberRepository.create({ channelId: channel.id, userId: dto.userId }),
    );
    return { ok: true };
  }

  async getChannelMessages(
    channelId: string,
    viewerId: string | null | undefined,
    viewerRole: UserRole | null | undefined,
    limit = 50,
    cursor?: string,
    parentId?: string | null,
  ) {
    const mappedRoomId = await this.channelMigrationService.resolveRoomIdForChannel(channelId);
    if (mappedRoomId) {
      const channel = await this.accessService.getChannelWithCommunity(channelId);
      const result = await this.roomMessagesService.listMessages(
        channel.community.id,
        mappedRoomId,
        limit,
        cursor,
        parentId ?? undefined,
        viewerId,
        viewerRole,
      );
      return {
        data: result.data.map((m) => ({
          ...m,
          channelId,
          parentId: m.parentMessageId ?? null,
        })),
        meta: result.meta,
      };
    }

    const channel = await this.accessService.getChannelWithCommunity(channelId);
    await this.accessService.assertChannelAccess(channel, viewerId, viewerRole);

    if (viewerId && channel.type !== ChannelType.PUBLIC) {
      await this.accessSessionsService.requirePremiumSession(
        viewerId,
        channel.community.creatorId,
        AccessSessionType.COMMUNITY,
        channel.community.id,
      );
    }

    const query = this.messageRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .where('m.channel_id = :channelId', { channelId })
      .orderBy('m.created_at', 'DESC')
      .take(limit + 1);

    if (parentId) {
      query.andWhere('m.parent_id = :parentId', { parentId });
    } else {
      query.andWhere('m.parent_id IS NULL');
    }

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
      query.andWhere('m.created_at < :cursor', { cursor: cursorDate });
    }

    const messages = await query.getMany();
    const hasMore = messages.length > limit;
    const data = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore
      ? Buffer.from(data[data.length - 1].createdAt.toISOString()).toString('base64')
      : null;

    const tierNames = await this.entitlementsService.getActiveTierNamesByUserIds(
      channel.community.creatorId,
      data.map((m) => m.userId),
    );

    return {
      data: data.reverse().map((m) => toPublicChannelMessage(m, tierNames.get(m.userId) ?? null)),
      meta: { cursor: nextCursor, hasMore },
    };
  }

  async sendChannelMessage(
    channelId: string,
    userId: string,
    dto: SendChannelMessageDto,
    viewerRole?: UserRole | null,
  ) {
    const mappedRoomId = await this.channelMigrationService.resolveRoomIdForChannel(channelId);
    if (mappedRoomId) {
      const channel = await this.accessService.getChannelWithCommunity(channelId);
      const roomMsg = await this.roomMessagesService.sendMessage(
        channel.community.id,
        mappedRoomId,
        userId,
        dto.body,
        dto.parentId ?? undefined,
        viewerRole,
      );
      const publicMsg = {
        ...roomMsg,
        channelId,
        parentId: roomMsg.parentMessageId ?? null,
      };
      this.eventEmitter.emit('channel.message', { channelId, message: publicMsg });
      return publicMsg;
    }

    const channel = await this.accessService.getChannelWithCommunity(channelId);
    await this.accessService.assertChannelAccess(channel, userId, viewerRole, 'write');

    if (await this.moderationService.isBanned(channel.community.id, userId)) {
      throw new ForbiddenException('You are banned from this community');
    }

    const spam = this.aiCommunityService.scoreContent(dto.body);
    if (spam.flagged) {
      void this.moderationQueueService.enqueueFlaggedMessage({
        communityId: channel.community.id,
        channelId,
        userId,
        messageBody: dto.body,
        score: spam.score,
        reasons: spam.reasons,
      });
      throw new ForbiddenException('Message blocked by automated moderation');
    }

    if (channel.type !== ChannelType.PUBLIC) {
      await this.accessSessionsService.requirePremiumSession(
        userId,
        channel.community.creatorId,
        AccessSessionType.COMMUNITY,
        channel.community.id,
      );
    }

    const key = `channel:msg:rate:${channelId}:${userId}`;
    const set = await this.redis.set(key, '1', 'EX', 3, 'NX');
    if (set !== 'OK') {
      throw new ForbiddenException('Slow down — wait before sending another message');
    }

    if (dto.parentId) {
      const parent = await this.messageRepository.findOne({
        where: { id: dto.parentId, channelId },
      });
      if (!parent || parent.deletedAt) {
        throw new BadRequestException('Parent message not found in this channel');
      }
    }

    const msg = await this.messageRepository.save(
      this.messageRepository.create({
        channelId,
        userId,
        body: dto.body.trim(),
        parentId: dto.parentId ?? null,
      }),
    );

    const full = await this.messageRepository.findOne({
      where: { id: msg.id },
      relations: ['user'],
    });

    const tierNames = await this.entitlementsService.getActiveTierNamesByUserIds(
      channel.community.creatorId,
      [userId],
    );
    const publicMsg = toPublicChannelMessage(full!, tierNames.get(userId) ?? null);
    this.eventEmitter.emit('channel.message', { channelId, message: publicMsg });
    this.eventEmitter.emit('community.activity', {
      userId,
      communityId: channel.community.id,
      xp: 2,
      source: 'channel_message',
    });
    return publicMsg;
  }

  async deleteChannelMessage(
    channelId: string,
    messageId: string,
    actorId: string,
    viewerRole?: UserRole | null,
  ) {
    const channel = await this.accessService.getChannelWithCommunity(channelId);
    const msg = await this.messageRepository.findOne({ where: { id: messageId, channelId } });
    if (!msg || msg.deletedAt) throw new NotFoundException('Message not found');

    const canModerate = await this.accessService.canModerateCommunity(
      channel.community.id,
      channel.community.creatorId,
      actorId,
      viewerRole,
    );
    const isAuthor = msg.userId === actorId;
    if (!canModerate && !isAuthor) {
      throw new ForbiddenException('Not allowed to delete this message');
    }

    msg.deletedAt = new Date();
    msg.body = '[deleted]';
    await this.messageRepository.save(msg);
    this.eventEmitter.emit('channel.message.deleted', { channelId, messageId });
    return { deleted: true };
  }

  private async assertChannelMutationsAllowed() {
    if (await this.featureFlagsService.isEnabled(CHANNELS_DEPRECATED_FLAG)) {
      throw new GoneException(CHANNELS_MIGRATION_HINT);
    }
  }

  private async getOwnedChannel(creatorId: string, channelId: string): Promise<Channel> {
    const channel = await this.accessService.getChannelWithCommunity(channelId);
    if (channel.community.creatorId !== creatorId) {
      throw new ForbiddenException();
    }
    return channel;
  }
}
