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
import { DataSource, In, Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { toCsv } from '../../common/utils/csv.util';
import {
  Community,
  CommunityType,
  CommunityVisibility,
  CREATOR_SELECTABLE_COMMUNITY_TYPES,
} from './entities/community.entity';
import { CommunityCategory } from './entities/community-category.entity';
import { Channel } from './entities/channel.entity';
import { ChannelMember } from './entities/channel-member.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import { CommunityRole, CommunityRoleType } from './entities/community-role.entity';
import {
  CreateCategoryDto,
  CreateChannelDto,
  CreateCommunityDto,
  InviteChannelMemberDto,
  SendChannelMessageDto,
  UpdateCategoryDto,
  UpdateChannelDto,
  UpdateCommunityDto,
} from './dto/community.dto';
import {
  toPublicCategory,
  toPublicChannel,
  toPublicChannelMessage,
  toPublicCommunity,
} from './community.mapper';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AccessSessionsService } from '../access-sessions/access-sessions.service';
import { AccessSessionType } from '../access-sessions/dto/access-session.dto';
import { CommunityModerationService } from './community-moderation.service';
import { AiModerationService } from './ai-moderation.service';
import { AiCommunityService } from './ai-community.service';
import { ChannelType } from '../entitlements/entities/channel-type.enum';
import { CommunityModerationQueueService } from './community-moderation-queue.service';
import { Stream, StreamStatus } from '../streaming/entities/stream.entity';
import { CommunityRoom } from './entities/community-room.entity';
import { UserRole } from '../users/entities/user.entity';
import {
  CommunityMember,
  CommunityMemberStatus,
} from './entities/community-member.entity';
import { ChannelMigrationService } from './channel-migration.service';
import { CommunityRoomMessagesService } from './community-room-messages.service';
import { FeatureFlagsService } from '../platform/feature-flags.service';
import {
  COMMUNITY_PERMISSIONS,
  COMMUNITY_ROLE_PERMISSION_MATRIX,
  permissionsForRole,
} from './community-permissions.constants';
import {
  CHANNELS_DEPRECATED_FLAG,
  CHANNELS_MIGRATION_HINT,
} from './community-deprecation.constants';

const DEFAULT_CHANNELS: Array<{ name: string; slug: string; type: ChannelType; sortOrder: number }> = [
  { name: 'Announcements', slug: 'announcements', type: ChannelType.PUBLIC, sortOrder: 0 },
  { name: 'General', slug: 'general', type: ChannelType.PUBLIC, sortOrder: 1 },
  { name: 'Live Discussion', slug: 'live-discussion', type: ChannelType.PUBLIC, sortOrder: 2 },
  { name: 'Premium Content', slug: 'premium-content', type: ChannelType.SUBSCRIBERS, sortOrder: 3 },
];

@Injectable()
export class CommunitiesService {
  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityCategory)
    private readonly categoryRepository: Repository<CommunityCategory>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(ChannelMember)
    private readonly memberRepository: Repository<ChannelMember>,
    @InjectRepository(CommunityMember)
    private readonly communityMemberRepository: Repository<CommunityMember>,
    @InjectRepository(ChannelMessage)
    private readonly messageRepository: Repository<ChannelMessage>,
    @InjectRepository(CommunityRole)
    private readonly roleRepository: Repository<CommunityRole>,
    private readonly entitlementsService: EntitlementsService,
    private readonly accessSessionsService: AccessSessionsService,
    @Inject(forwardRef(() => CommunityModerationService))
    private readonly moderationService: CommunityModerationService,
    private readonly aiModerationService: AiModerationService,
    private readonly aiCommunityService: AiCommunityService,
    private readonly moderationQueueService: CommunityModerationQueueService,
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @InjectRepository(CommunityRoom)
    private readonly roomRepository: Repository<CommunityRoom>,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
    private readonly dataSource: DataSource,
    private readonly channelMigrationService: ChannelMigrationService,
    @Inject(forwardRef(() => CommunityRoomMessagesService))
    private readonly roomMessagesService: CommunityRoomMessagesService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  @OnEvent('creator.approved')
  async seedCommunityOnApproval(payload: { userId: string }) {
    await this.ensureDefaultCommunity(payload.userId);
  }

  async ensureDefaultCommunity(creatorId: string): Promise<Community> {
    const existing = await this.getDefaultCommunity(creatorId);
    if (existing) return existing;

    return this.dataSource.transaction(async (manager) => {
      const found = await manager.findOne(Community, {
        where: { creatorId },
        order: { createdAt: 'ASC' },
      });
      if (found) return found;

      const community = await manager.save(
        manager.create(Community, { creatorId, name: 'Community', slug: 'community' }),
      );

      for (const def of DEFAULT_CHANNELS) {
        await manager.save(
          manager.create(Channel, {
            communityId: community.id,
            ...def,
          }),
        );
      }

      return community;
    });
  }

  /** @deprecated Use ensureDefaultCommunity */
  async ensureCommunity(creatorId: string): Promise<Community> {
    return this.ensureDefaultCommunity(creatorId);
  }

  async getDefaultCommunity(creatorId: string): Promise<Community | null> {
    const bySlug = await this.communityRepository.findOne({
      where: { creatorId, slug: 'community' },
    });
    if (bySlug) return bySlug;
    return this.communityRepository.findOne({
      where: { creatorId },
      order: { createdAt: 'ASC' },
    });
  }

  async listCommunitiesForCreator(creatorId: string, viewerId?: string | null, viewerRole?: UserRole | null) {
    const communities = await this.communityRepository.find({
      where: { creatorId },
      order: { createdAt: 'ASC' },
    });
    if (!communities.length) return [];

    if (viewerId === creatorId || viewerRole === UserRole.ADMIN) {
      return communities.map(toPublicCommunity);
    }

    const cacheKey = viewerId
      ? `community:list:visible:${creatorId}:${viewerId}`
      : null;
    if (cacheKey) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached) as ReturnType<typeof toPublicCommunity>[];
        } catch {
          await this.redis.del(cacheKey);
        }
      }
    }

    let activeSubscriptions: Awaited<
      ReturnType<EntitlementsService['listActiveSubscriptionsForCreator']>
    > = [];
    if (viewerId) {
      activeSubscriptions = await this.entitlementsService.listActiveSubscriptionsForCreator(
        viewerId,
        creatorId,
      );
    }

    const communityIds = communities.map((c) => c.id);
    const viewerRoles = viewerId
      ? await this.roleRepository.find({
          where: { communityId: In(communityIds), userId: viewerId },
        })
      : [];
    const roleByCommunity = new Map(viewerRoles.map((r) => [r.communityId, r]));

    const activeCommunityMemberRows = viewerId
      ? await this.communityMemberRepository.find({
          where: {
            communityId: In(communityIds),
            userId: viewerId,
            status: CommunityMemberStatus.ACTIVE,
          },
          select: ['communityId'],
        })
      : [];
    const activeCommunityMemberIds = new Set(activeCommunityMemberRows.map((r) => r.communityId));

    const inviteCommunityIds = communities
      .filter((c) => c.visibility === CommunityVisibility.INVITE)
      .map((c) => c.id);

    const inviteChannels = inviteCommunityIds.length
      ? await this.channelRepository.find({
          where: { communityId: In(inviteCommunityIds), type: ChannelType.INVITE },
          select: ['id', 'communityId'],
        })
      : [];
    const inviteChannelIds = inviteChannels.map((c) => c.id);

    const invitedChannelIds = new Set<string>();
    if (viewerId && inviteChannelIds.length) {
      const memberships = await this.memberRepository.find({
        where: { userId: viewerId, channelId: In(inviteChannelIds) },
        select: ['channelId'],
      });
      for (const m of memberships) invitedChannelIds.add(m.channelId);
    }

    const inviteChannelsByCommunity = new Map<string, string[]>();
    for (const ch of inviteChannels) {
      const list = inviteChannelsByCommunity.get(ch.communityId) ?? [];
      list.push(ch.id);
      inviteChannelsByCommunity.set(ch.communityId, list);
    }

    const visible = communities.filter((community) =>
      this.canViewCommunityBatched(
        community,
        viewerId,
        viewerRole,
        this.entitlementsService.subscriptionCoversCommunity(
          activeSubscriptions,
          community.id,
        ),
        roleByCommunity.get(community.id),
        activeCommunityMemberIds.has(community.id),
        inviteChannelsByCommunity.get(community.id) ?? [],
        invitedChannelIds,
      ),
    );
    const result = visible.map(toPublicCommunity);
    if (cacheKey) {
      await this.redis.setex(cacheKey, 30, JSON.stringify(result));
    }
    return result;
  }

  async getCommunityById(communityId: string, viewerId?: string | null, viewerRole?: UserRole | null) {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    return this.buildCommunityPayload(community, viewerId, viewerRole);
  }

  async getCommunityBySlug(
    creatorId: string,
    slug: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    const community = await this.communityRepository.findOne({ where: { creatorId, slug } });
    if (!community) throw new NotFoundException('Community not found');
    return this.buildCommunityPayload(community, viewerId, viewerRole);
  }

  /** Legacy: returns default community for creator */
  async getCommunityByCreator(creatorId: string, viewerId?: string | null, viewerRole?: UserRole | null) {
    const community = await this.getDefaultCommunity(creatorId);
    if (!community) {
      return { community: null, categories: [], channels: [] };
    }
    return this.buildCommunityPayload(community, viewerId, viewerRole);
  }

  /**
   * Guard creator-supplied community types. COURSE/COHORT are platform-managed
   * (derived from course linkage) and must never be set or impersonated via the
   * public create/update API — protects the integrity of the type taxonomy.
   */
  private assertCreatorSelectableType(type: CommunityType): void {
    if (!CREATOR_SELECTABLE_COMMUNITY_TYPES.includes(type)) {
      throw new BadRequestException(
        `communityType '${type}' is managed by the platform and cannot be set directly`,
      );
    }
  }

  async createCommunity(creatorId: string, dto: CreateCommunityDto) {
    const slug =
      dto.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') ||
      dto.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const existing = await this.communityRepository.findOne({ where: { creatorId, slug } });
    if (existing) throw new BadRequestException('Community slug already exists');

    const communityType = dto.communityType ?? CommunityType.STANDARD;
    this.assertCreatorSelectableType(communityType);

    const community = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(Community, {
          creatorId,
          name: dto.name.trim(),
          slug,
          visibility: dto.visibility ?? CommunityVisibility.PUBLIC,
          communityType,
          brandId: dto.brandId ?? null,
        }),
      );

      for (const def of DEFAULT_CHANNELS) {
        await manager.save(
          manager.create(Channel, {
            communityId: created.id,
            ...def,
          }),
        );
      }

      return created;
    });

    return toPublicCommunity(community);
  }

  async updateCommunity(creatorId: string, communityId: string, dto: UpdateCommunityDto) {
    const community = await this.getOwnedCommunity(creatorId, communityId);
    if (dto.name !== undefined) community.name = dto.name.trim();
    if (dto.slug !== undefined) {
      const slug = dto.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const clash = await this.communityRepository.findOne({ where: { creatorId, slug } });
      if (clash && clash.id !== communityId) throw new BadRequestException('Slug already in use');
      community.slug = slug;
    }
    if (dto.visibility !== undefined) community.visibility = dto.visibility;
    if (dto.communityType !== undefined) {
      // Both the new value and the current value must be creator-selectable:
      // prevents re-typing a platform-managed (course/cohort) community and
      // prevents impersonating a managed type.
      this.assertCreatorSelectableType(dto.communityType);
      this.assertCreatorSelectableType(community.communityType);
      community.communityType = dto.communityType;
    }
    if (dto.settings !== undefined) community.settings = dto.settings;
    if (dto.brandId !== undefined) community.brandId = dto.brandId;
    const saved = await this.communityRepository.save(community);
    return toPublicCommunity(saved);
  }

  async listCategories(creatorId: string, communityId: string) {
    await this.getOwnedCommunity(creatorId, communityId);
    const categories = await this.categoryRepository.find({
      where: { communityId },
      order: { sortOrder: 'ASC' },
    });
    return categories.map(toPublicCategory);
  }

  async createCategory(creatorId: string, communityId: string, dto: CreateCategoryDto) {
    await this.getOwnedCommunity(creatorId, communityId);
    const slug =
      dto.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') ||
      dto.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const existing = await this.categoryRepository.findOne({ where: { communityId, slug } });
    if (existing) throw new BadRequestException('Category slug already exists');

    const category = await this.categoryRepository.save(
      this.categoryRepository.create({
        communityId,
        name: dto.name.trim(),
        slug,
        sortOrder: dto.sortOrder ?? 99,
      }),
    );
    return toPublicCategory(category);
  }

  async updateCategory(
    creatorId: string,
    communityId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ) {
    await this.getOwnedCommunity(creatorId, communityId);
    const category = await this.categoryRepository.findOne({ where: { id: categoryId, communityId } });
    if (!category) throw new NotFoundException('Category not found');
    if (dto.name !== undefined) category.name = dto.name.trim();
    if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;
    const saved = await this.categoryRepository.save(category);
    return toPublicCategory(saved);
  }

  async deleteCategory(creatorId: string, communityId: string, categoryId: string) {
    await this.getOwnedCommunity(creatorId, communityId);
    const category = await this.categoryRepository.findOne({ where: { id: categoryId, communityId } });
    if (!category) throw new NotFoundException('Category not found');
    await this.channelRepository.update({ categoryId }, { categoryId: null });
    await this.categoryRepository.delete(categoryId);
    return { deleted: true };
  }

  async createChannel(creatorId: string, dto: CreateChannelDto, communityId?: string) {
    await this.assertChannelMutationsAllowed();
    const community = communityId
      ? await this.getOwnedCommunity(creatorId, communityId)
      : dto.communityId
        ? await this.getOwnedCommunity(creatorId, dto.communityId)
        : await this.ensureDefaultCommunity(creatorId);

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
    communityId: string,
    channelIds: string[],
  ) {
    await this.assertChannelMutationsAllowed();
    await this.getOwnedCommunity(creatorId, communityId);
    const channels = await this.channelRepository.find({ where: { communityId } });
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
      [communityId, channelIds, ...channelIds],
    );
    return { reordered: true };
  }

  async getCommunityLayout(
    communityId: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    const payload = await this.getCommunityById(communityId, viewerId, viewerRole);
    const rooms = await this.roomRepository.find({
      where: { communityId, isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return {
      ...payload,
      rooms: rooms.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        roomType: r.roomType,
        description: r.description,
        categoryId: r.categoryId,
        sortOrder: r.sortOrder,
        settings: r.settings,
      })),
    };
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
      const channel = await this.getChannelWithCommunity(channelId);
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

    const channel = await this.getChannelWithCommunity(channelId);
    await this.assertChannelAccess(channel, viewerId, viewerRole);

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
      const channel = await this.getChannelWithCommunity(channelId);
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

    const channel = await this.getChannelWithCommunity(channelId);
    await this.assertChannelAccess(channel, userId, viewerRole, 'write');

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
    const channel = await this.getChannelWithCommunity(channelId);
    const msg = await this.messageRepository.findOne({ where: { id: messageId, channelId } });
    if (!msg || msg.deletedAt) throw new NotFoundException('Message not found');

    const canModerate = await this.canModerateCommunity(
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

  async canModerateCommunity(
    communityId: string,
    creatorId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ): Promise<boolean> {
    if (viewerRole === UserRole.ADMIN) return true;
    if (userId === creatorId) return true;
    const assignment = await this.roleRepository.findOne({ where: { communityId, userId } });
    if (!assignment) return false;
    return (
      assignment.role === CommunityRoleType.ADMIN ||
      assignment.role === CommunityRoleType.MODERATOR ||
      assignment.role === CommunityRoleType.OWNER
    );
  }

  private async assertChannelMutationsAllowed() {
    if (await this.featureFlagsService.isEnabled(CHANNELS_DEPRECATED_FLAG)) {
      throw new GoneException(CHANNELS_MIGRATION_HINT);
    }
  }

  private async buildCommunityPayload(
    community: Community,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    const canView = await this.canViewCommunity(community, viewerId, viewerRole);
    if (!canView) {
      throw new ForbiddenException('You do not have access to this community');
    }

    const [channels, categories, channelsDeprecated] = await Promise.all([
      this.channelRepository.find({
        where: { communityId: community.id },
        order: { sortOrder: 'ASC' },
      }),
      this.categoryRepository.find({
        where: { communityId: community.id },
        order: { sortOrder: 'ASC' },
      }),
      this.featureFlagsService.isEnabled(CHANNELS_DEPRECATED_FLAG),
    ]);

    if (channelsDeprecated) {
      return {
        community: toPublicCommunity(community),
        categories: categories.map(toPublicCategory),
        channels: [],
      };
    }

    const creatorId = community.creatorId;
    const isOwner = viewerId === creatorId;
    const isAdmin = viewerRole === UserRole.ADMIN;

    const inviteChannelIds = channels
      .filter((c) => c.type === ChannelType.INVITE)
      .map((c) => c.id);
    const memberChannelIds =
      viewerId && inviteChannelIds.length > 0
        ? await this.loadInviteMemberChannelIds(viewerId, inviteChannelIds)
        : new Set<string>();

    const accessList = await this.entitlementsService.checkChannelAccessMany(
      viewerId,
      viewerRole,
      channels.map((channel) => ({
        type: channel.type,
        requiredTierId: channel.requiredTierId,
        creatorId,
        communityId: community.id,
        channelId: channel.id,
        isMember: memberChannelIds.has(channel.id),
      })),
      { isOwner, isAdmin },
    );

    const channelsWithAccess = channels.map((channel, index) =>
      toPublicChannel(channel, accessList[index]),
    );

    return {
      community: toPublicCommunity(community),
      categories: categories.map(toPublicCategory),
      channels: channelsWithAccess,
    };
  }

  private canViewCommunityBatched(
    community: Community,
    viewerId: string | null | undefined,
    viewerRole: UserRole | null | undefined,
    subscriptionCoversCommunity: boolean,
    role: CommunityRole | undefined,
    isActiveCommunityMember: boolean,
    inviteChannelIds: string[],
    invitedChannelIds: Set<string>,
  ): boolean {
    const creatorId = community.creatorId;
    if (viewerId === creatorId) return true;
    if (viewerRole === UserRole.ADMIN) return true;

    if (community.visibility === CommunityVisibility.PRIVATE) {
      if (!viewerId) return false;
      if (role) return true;
      return isActiveCommunityMember;
    }

    if (community.visibility === CommunityVisibility.PAID) {
      return !!viewerId && subscriptionCoversCommunity;
    }

    if (community.visibility === CommunityVisibility.INVITE) {
      if (!viewerId) return false;
      if (role) return true;
      if (isActiveCommunityMember) return true;
      if (subscriptionCoversCommunity) return true;
      if (!inviteChannelIds.length) return false;
      return inviteChannelIds.some((id) => invitedChannelIds.has(id));
    }

    return true;
  }

  private async canViewCommunity(
    community: Community,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ): Promise<boolean> {
    const creatorId = community.creatorId;
    if (viewerId === creatorId) return true;
    if (viewerRole === UserRole.ADMIN) return true;

    if (community.visibility === CommunityVisibility.PUBLIC) {
      return true;
    }

    if (!viewerId) return false;

    if (community.visibility === CommunityVisibility.PRIVATE) {
      const [role, activeMember] = await Promise.all([
        this.roleRepository.findOne({
          where: { communityId: community.id, userId: viewerId },
        }),
        this.communityMemberRepository.findOne({
          where: {
            communityId: community.id,
            userId: viewerId,
            status: CommunityMemberStatus.ACTIVE,
          },
        }),
      ]);
      return !!role || !!activeMember;
    }

    if (community.visibility === CommunityVisibility.PAID) {
      const membership = await this.entitlementsService.getMembershipForViewer(
        viewerId,
        creatorId,
        community.id,
      );
      return membership.active;
    }

    if (community.visibility === CommunityVisibility.INVITE) {
      const [role, activeMember, membership, inviteChannels] = await Promise.all([
        this.roleRepository.findOne({
          where: { communityId: community.id, userId: viewerId },
        }),
        this.communityMemberRepository.findOne({
          where: {
            communityId: community.id,
            userId: viewerId,
            status: CommunityMemberStatus.ACTIVE,
          },
        }),
        this.entitlementsService.getMembershipForViewer(viewerId, creatorId, community.id),
        this.channelRepository.find({
          where: { communityId: community.id, type: ChannelType.INVITE },
          select: ['id'],
        }),
      ]);
      if (role) return true;
      if (activeMember) return true;
      if (membership.active) return true;
      if (inviteChannels.length === 0) return false;
      const member = await this.memberRepository.findOne({
        where: {
          userId: viewerId,
          channelId: In(inviteChannels.map((c) => c.id)),
        },
      });
      return !!member;
    }

    return true;
  }

  async assertCommunityAccess(
    communityId: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ): Promise<Community> {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (viewerId && (await this.moderationService.isBanned(communityId, viewerId))) {
      throw new ForbiddenException('You are banned from this community');
    }
    if (viewerId) {
      const suspended = await this.communityMemberRepository.findOne({
        where: {
          communityId,
          userId: viewerId,
          status: CommunityMemberStatus.SUSPENDED,
        },
      });
      if (suspended) {
        throw new ForbiddenException('Your community membership is suspended');
      }
    }
    const canView = await this.canViewCommunity(community, viewerId, viewerRole);
    if (!canView) throw new ForbiddenException('You do not have access to this community');
    return community;
  }

  /** Invalidate cached community list visibility for a viewer. */
  async bustCommunityListCache(userId: string, creatorId: string): Promise<void> {
    await this.redis.del(`community:list:visible:${creatorId}:${userId}`);
  }

  /** Lightweight access metadata for join-request UX (no channel payload). */
  async getCommunityAccessMeta(
    creatorId: string,
    slug: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    const community = await this.communityRepository.findOne({ where: { creatorId, slug } });
    if (!community) throw new NotFoundException('Community not found');

    const canView = viewerId
      ? await this.canViewCommunity(community, viewerId, viewerRole)
      : community.visibility === CommunityVisibility.PUBLIC;

    let joinRequestStatus: 'none' | 'pending' | 'active' | 'rejected' = 'none';
    if (viewerId) {
      const member = await this.communityMemberRepository.findOne({
        where: { communityId: community.id, userId: viewerId },
      });
      if (member?.status === CommunityMemberStatus.PENDING) joinRequestStatus = 'pending';
      else if (member?.status === CommunityMemberStatus.ACTIVE) joinRequestStatus = 'active';
      else if (member?.status === CommunityMemberStatus.REJECTED) joinRequestStatus = 'rejected';
    }

    const canRequestJoin =
      !!viewerId &&
      !canView &&
      (community.visibility === CommunityVisibility.PRIVATE ||
        community.visibility === CommunityVisibility.INVITE) &&
      joinRequestStatus !== 'pending' &&
      joinRequestStatus !== 'active';

    return {
      communityId: community.id,
      name: community.name,
      slug: community.slug,
      visibility: community.visibility,
      canView,
      canRequestJoin,
      joinRequestStatus,
    };
  }

  /** Validates a user may submit a join request (PRIVATE or INVITE communities without access). */
  async assertCanRequestJoin(
    communityId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ): Promise<Community> {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (await this.moderationService.isBanned(communityId, userId)) {
      throw new ForbiddenException('You are banned from this community');
    }
    if (userId === community.creatorId || viewerRole === UserRole.ADMIN) {
      throw new BadRequestException('You already have access to this community');
    }
    const allowsJoinRequest =
      community.visibility === CommunityVisibility.PRIVATE ||
      community.visibility === CommunityVisibility.INVITE;
    if (!allowsJoinRequest) {
      throw new BadRequestException('This community does not accept join requests');
    }
    if (await this.canViewCommunity(community, userId, viewerRole)) {
      throw new BadRequestException('You already have access to this community');
    }
    return community;
  }

  async assertOwnedCommunity(creatorId: string, communityId: string): Promise<Community> {
    return this.getOwnedCommunity(creatorId, communityId);
  }

  /** Creator or delegated OWNER/ADMIN may manage community studio content. */
  async assertCommunityStudioAccess(
    actorId: string,
    communityId: string,
    viewerRole?: UserRole | null,
  ): Promise<Community> {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (viewerRole === UserRole.ADMIN) return community;
    if (community.creatorId === actorId) return community;
    const assignment = await this.roleRepository.findOne({
      where: { communityId, userId: actorId },
    });
    if (
      assignment &&
      (assignment.role === CommunityRoleType.OWNER ||
        assignment.role === CommunityRoleType.ADMIN)
    ) {
      return community;
    }
    throw new ForbiddenException('Insufficient permissions for community studio');
  }

  async canCoachCommunity(
    communityId: string,
    creatorId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ): Promise<boolean> {
    if (viewerRole === UserRole.ADMIN) return true;
    if (userId === creatorId) return true;
    const assignment = await this.roleRepository.findOne({ where: { communityId, userId } });
    return assignment?.role === CommunityRoleType.COACH;
  }

  private async getOwnedCommunity(creatorId: string, communityId: string): Promise<Community> {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community || community.creatorId !== creatorId) {
      throw new ForbiddenException('Community not found or not owned');
    }
    return community;
  }

  private async getChannelWithCommunity(channelId: string): Promise<Channel & { community: Community }> {
    const channel = await this.channelRepository.findOne({
      where: { id: channelId },
      relations: ['community'],
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel as Channel & { community: Community };
  }

  private async getOwnedChannel(creatorId: string, channelId: string): Promise<Channel> {
    const channel = await this.getChannelWithCommunity(channelId);
    if (channel.community.creatorId !== creatorId) {
      throw new ForbiddenException();
    }
    return channel;
  }

  private async loadInviteMemberChannelIds(
    viewerId: string,
    channelIds: string[],
  ): Promise<Set<string>> {
    const unique = [...new Set(channelIds.filter(Boolean))];
    if (unique.length === 0) return new Set();
    const rows = await this.memberRepository.find({
      where: { userId: viewerId, channelId: In(unique) },
      select: ['channelId'],
    });
    return new Set(rows.map((r) => r.channelId));
  }

  async verifyChannelAccess(
    channelId: string,
    viewerId: string | null | undefined,
    viewerRole?: UserRole | null,
  ): Promise<void> {
    const channel = await this.getChannelWithCommunity(channelId);
    await this.assertChannelAccess(channel, viewerId, viewerRole);
  }

  private async assertChannelAccess(
    channel: Channel & { community: Community },
    viewerId: string | null | undefined,
    viewerRole?: UserRole | null,
    action: 'read' | 'write' = 'read',
  ) {
    const creatorId = channel.community.creatorId;
    const isOwner = viewerId === creatorId;
    const isAdmin = viewerRole === UserRole.ADMIN;

    const isMember =
      channel.type === ChannelType.INVITE && viewerId
        ? !!(await this.memberRepository.findOne({
            where: { channelId: channel.id, userId: viewerId },
          }))
        : false;

    const access = await this.entitlementsService.checkChannelAccess(
      viewerId,
      {
        type: channel.type,
        requiredTierId: channel.requiredTierId,
        creatorId,
        communityId: channel.community.id,
        channelId: channel.id,
        isMember,
      },
      { isOwner, isAdmin, action },
    );

    if (!access.allowed) {
      throw new ForbiddenException('You do not have access to this channel');
    }
  }

  async listModeratedCommunities(userId: string) {
    const assignments = await this.roleRepository.find({
      where: { userId },
      relations: ['community', 'community.creator'],
      order: { createdAt: 'DESC' },
    });

    return {
      data: assignments.map((a) => ({
        communityId: a.communityId,
        role: a.role,
        community: a.community
          ? {
              id: a.community.id,
              name: a.community.name,
              slug: a.community.slug,
              creatorId: a.community.creatorId,
              creator: a.community.creator
                ? {
                    username: a.community.creator.username,
                    displayName: a.community.creator.displayName,
                  }
                : null,
            }
          : null,
      })),
    };
  }

  async searchCommunities(query: string, limit = 20, type?: CommunityType) {
    const term = query.trim();
    if (term.length < 2) return { data: [] };
    const pattern = `%${term}%`;
    const take = Math.min(limit, 50);
    const qb = this.communityRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.creator', 'creator')
      .where('c.visibility = :visibility', { visibility: CommunityVisibility.PUBLIC })
      .andWhere('(c.name ILIKE :pattern OR c.slug ILIKE :pattern)', { pattern });
    if (type) qb.andWhere('c.communityType = :type', { type });
    const communities = await qb.orderBy('c.createdAt', 'DESC').take(take).getMany();

    return {
      data: communities.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        creatorId: c.creatorId,
        creator: c.creator
          ? { username: c.creator.username, displayName: c.creator.displayName }
          : null,
        visibility: c.visibility,
        communityType: c.communityType,
      })),
    };
  }

  async listFeaturedCommunities(limit = 12, type?: CommunityType) {
    const take = Math.min(limit, 24);
    const qb = this.communityRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.creator', 'creator')
      .where('c.visibility = :visibility', { visibility: CommunityVisibility.PUBLIC });
    if (type) qb.andWhere('c.communityType = :type', { type });
    const communities = await qb.orderBy('c.createdAt', 'DESC').take(take).getMany();

    return {
      data: communities.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        creatorId: c.creatorId,
        creator: c.creator
          ? { username: c.creator.username, displayName: c.creator.displayName }
          : null,
        visibility: c.visibility,
        communityType: c.communityType,
      })),
    };
  }

  async getCommunityAnalytics(creatorId: string, communityId: string) {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community || community.creatorId !== creatorId) {
      throw new ForbiddenException('Community not found or not owned');
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [messagesRow, roomMessagesRow] = await Promise.all([
      this.dataSource.query<{ count: string }[]>(
        `SELECT COUNT(*)::int AS count
         FROM channel_messages m
         INNER JOIN channels ch ON ch.id = m.channel_id
         WHERE ch.community_id = $1 AND m.created_at >= $2 AND m.deleted_at IS NULL`,
        [communityId, since],
      ),
      this.dataSource.query<{ count: string }[]>(
        `SELECT COUNT(*)::int AS count
         FROM community_room_messages m
         INNER JOIN community_rooms r ON r.id = m.room_id
         WHERE r.community_id = $1 AND m.created_at >= $2 AND m.deleted_at IS NULL`,
        [communityId, since],
      ),
    ]);

    const [activeRow] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(DISTINCT m.user_id)::int AS count
       FROM channel_messages m
       INNER JOIN channels ch ON ch.id = m.channel_id
       WHERE ch.community_id = $1 AND m.created_at >= $2 AND m.deleted_at IS NULL`,
      [communityId, since],
    );

    const [postsRow] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::int AS count FROM community_posts
       WHERE community_id = $1 AND created_at >= $2`,
      [communityId, since],
    );

    const [pollVotesRow] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::int AS count
       FROM community_poll_votes v
       INNER JOIN community_polls p ON p.id = v.poll_id
       WHERE p.community_id = $1 AND v.created_at >= $2`,
      [communityId, since],
    );

    const channelCount = await this.channelRepository.count({ where: { communityId } });
    const trends = await this.getCommunityDailyTrends(communityId, since);

    return {
      communityId,
      periodDays: 7,
      messagesLast7Days:
        Number(messagesRow?.[0]?.count ?? 0) + Number(roomMessagesRow?.[0]?.count ?? 0),
      channelMessagesLast7Days: Number(messagesRow?.[0]?.count ?? 0),
      roomMessagesLast7Days: Number(roomMessagesRow?.[0]?.count ?? 0),
      activeMembersLast7Days: Number(activeRow?.count ?? 0),
      postsLast7Days: Number(postsRow?.count ?? 0),
      pollVotesLast7Days: Number(pollVotesRow?.count ?? 0),
      channelCount,
      retention: await this.getCommunityRetentionMetrics(creatorId, communityId),
      trends,
    };
  }

  private async getCommunityDailyTrends(communityId: string, since: Date) {
    const messageRows = await this.dataSource.query<{ day: string; count: string }[]>(
      `SELECT to_char(date_trunc('day', m.created_at), 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS count
       FROM channel_messages m
       INNER JOIN channels ch ON ch.id = m.channel_id
       WHERE ch.community_id = $1 AND m.created_at >= $2 AND m.deleted_at IS NULL
       GROUP BY 1 ORDER BY 1`,
      [communityId, since],
    );
    const postRows = await this.dataSource.query<{ day: string; count: string }[]>(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS count
       FROM community_posts
       WHERE community_id = $1 AND created_at >= $2
       GROUP BY 1 ORDER BY 1`,
      [communityId, since],
    );
    return {
      dailyMessages: messageRows.map((r) => ({ date: r.day, count: Number(r.count) })),
      dailyPosts: postRows.map((r) => ({ date: r.day, count: Number(r.count) })),
    };
  }

  /** Active community IDs the viewer belongs to (membership implies access). */
  async listActiveMemberCommunityIds(userId: string): Promise<string[]> {
    const rows = await this.communityMemberRepository.find({
      where: { userId, status: CommunityMemberStatus.ACTIVE },
      select: { communityId: true },
    });
    return rows.map((r) => r.communityId);
  }

  async getCreatorBusinessAnalytics(creatorId: string) {
    const periodDays = 30;
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const membership = await this.entitlementsService.getSubscriberAnalytics(creatorId);

    const communities = await this.communityRepository.find({
      where: { creatorId },
      order: { createdAt: 'ASC' },
    });
    const communityIds = communities.map((c) => c.id);

    let engagedMembers = 0;
    let activeChatters = 0;
    let postAuthors = 0;

    if (communityIds.length > 0) {
      const [[engagedRow], [chatRow], [postAuthorRow]] = await Promise.all([
        this.dataSource.query<{ count: string }[]>(
          `SELECT COUNT(DISTINCT user_id)::int AS count FROM member_xp
           WHERE community_id = ANY($1::uuid[])`,
          [communityIds],
        ),
        this.dataSource.query<{ count: string }[]>(
          `SELECT COUNT(DISTINCT user_id)::int AS count FROM (
             SELECT m.user_id
             FROM channel_messages m
             INNER JOIN channels ch ON ch.id = m.channel_id
             WHERE ch.community_id = ANY($1::uuid[]) AND m.created_at >= $2 AND m.deleted_at IS NULL
             UNION
             SELECT m.user_id
             FROM community_room_messages m
             INNER JOIN community_rooms r ON r.id = m.room_id
             WHERE r.community_id = ANY($1::uuid[]) AND m.created_at >= $2 AND m.deleted_at IS NULL
           ) chatters`,
          [communityIds, since],
        ),
        this.dataSource.query<{ count: string }[]>(
          `SELECT COUNT(DISTINCT author_id)::int AS count FROM community_posts
           WHERE community_id = ANY($1::uuid[]) AND created_at >= $2`,
          [communityIds, since],
        ),
      ]);
      engagedMembers = Number(engagedRow?.count ?? 0);
      activeChatters = Number(chatRow?.count ?? 0);
      postAuthors = Number(postAuthorRow?.count ?? 0);
    }

    const [courseEnrollRow] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(DISTINCT e.user_id)::int AS count
       FROM course_enrollments e
       INNER JOIN courses c ON c.id = e.course_id
       WHERE c.creator_id = $1 AND e.enrolled_at >= $2`,
      [creatorId, since],
    );
    const courseEnrollments = Number(courseEnrollRow?.count ?? 0);

    const payingMembers = membership.active + membership.trial;
    const pct = (n: number) =>
      payingMembers > 0 ? Math.round((n / payingMembers) * 100) : 0;

    const funnel = [
      {
        stage: 'paying_members',
        label: 'Paying members',
        count: payingMembers,
        rateFromTop: 100,
      },
      {
        stage: 'engaged_xp',
        label: 'Engaged (XP)',
        count: engagedMembers,
        rateFromTop: pct(engagedMembers),
      },
      {
        stage: 'active_chat',
        label: 'Active in chat (30d)',
        count: activeChatters,
        rateFromTop: pct(activeChatters),
      },
      {
        stage: 'post_authors',
        label: 'Posted (30d)',
        count: postAuthors,
        rateFromTop: pct(postAuthors),
      },
      {
        stage: 'course_enrolled',
        label: 'Course enrolled (30d)',
        count: courseEnrollments,
        rateFromTop: pct(courseEnrollments),
      },
    ];

    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeRows =
      communityIds.length === 0
        ? []
        : await this.dataSource.query<Array<{ community_id: string; count: string }>>(
            `SELECT community_id, COUNT(DISTINCT user_id)::int AS count FROM (
               SELECT ch.community_id, m.user_id
               FROM channel_messages m
               INNER JOIN channels ch ON ch.id = m.channel_id
               WHERE ch.community_id = ANY($1::uuid[]) AND m.created_at >= $2 AND m.deleted_at IS NULL
               UNION
               SELECT r.community_id, m.user_id
               FROM community_room_messages m
               INNER JOIN community_rooms r ON r.id = m.room_id
               WHERE r.community_id = ANY($1::uuid[]) AND m.created_at >= $2 AND m.deleted_at IS NULL
             ) active GROUP BY community_id`,
            [communityIds, since7],
          );
    const activeByCommunity = new Map(
      activeRows.map((r) => [r.community_id, Number(r.count ?? 0)]),
    );
    const communitySummaries = communities.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      activeMembersLast7Days: activeByCommunity.get(c.id) ?? 0,
    }));

    const cohortRetention = await this.getSubscriberCohortRetention(creatorId);

    // Churn rate: subscriptions canceled in the last 30 days vs. total
    // that were active at start of period (approximated as active+trial+canceled30d).
    const [canceledRow] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::int AS count FROM member_subscriptions
       WHERE creator_id = $1 AND status = 'canceled' AND updated_at >= $2`,
      [creatorId, since],
    );
    const canceledLast30Days = Number(canceledRow?.count ?? 0);
    const denominator = membership.active + membership.trial + canceledLast30Days;
    const churnRate30d = denominator > 0 ? Math.round((canceledLast30Days / denominator) * 10000) / 100 : 0;

    // Engagement score: weighted activity signals normalized to 0-100.
    // Weights: active chatters (40%), post authors (30%), course enrollments (30%).
    const totalMembers = membership.active + membership.trial;
    const engagementScore =
      totalMembers > 0
        ? Math.min(
            100,
            Math.round(
              (activeChatters * 0.4 + postAuthors * 0.3 + courseEnrollments * 0.3) /
                totalMembers *
                100,
            ),
          )
        : 0;

    // Live event revenue (30d) from paid stream tickets
    const [liveRevenueRow] = await this.dataSource.query<{ total: string | null }[]>(
      `SELECT COALESCE(SUM(sep.amount_cents), 0)::bigint AS total
       FROM stream_event_purchases sep
       INNER JOIN streams s ON s.id = sep.stream_id
       WHERE s.user_id = $1 AND sep.created_at >= $2 AND sep.status = 'completed' AND sep.grant_source = 'purchase'`,
      [creatorId, since],
    );
    const liveRevenue30dCents = Number(liveRevenueRow?.total ?? 0);

    return {
      periodDays,
      membership: {
        active: membership.active,
        trial: membership.trial,
        canceled: membership.canceled,
        mrrCents: membership.mrrCents,
        totalRevenue30d: liveRevenue30dCents,
      },
      revenue: {
        mrr: membership.mrrCents,
        arr: membership.mrrCents * 12,
        liveEvents30d: liveRevenue30dCents,
      },
      kpis: {
        churnRate30d,
        canceledLast30Days,
        engagementScore,
      },
      engagement: {
        engagedMembers,
        activeChatters,
        postAuthors,
        courseEnrollments,
      },
      funnel,
      cohortRetention,
      communities: communitySummaries,
    };
  }

  /**
   * Long-format (section,key,value) CSV of the creator business analytics.
   * Reuses getCreatorBusinessAnalytics so the export always matches the
   * dashboard. Field serialization is CSV-injection hardened via csv.util.
   */
  async getCreatorBusinessAnalyticsCsv(creatorId: string): Promise<string> {
    const a = await this.getCreatorBusinessAnalytics(creatorId);
    const rows: Array<[string, string, number]> = [
      ['membership', 'active', a.membership.active],
      ['membership', 'trial', a.membership.trial],
      ['membership', 'canceled', a.membership.canceled],
      ['membership', 'mrr_cents', a.membership.mrrCents],
      ['kpi', 'churn_rate_30d', a.kpis.churnRate30d],
      ['kpi', 'canceled_last_30d', a.kpis.canceledLast30Days],
      ['kpi', 'engagement_score', a.kpis.engagementScore],
      ['engagement', 'engaged_members', a.engagement.engagedMembers],
      ['engagement', 'active_chatters', a.engagement.activeChatters],
      ['engagement', 'post_authors', a.engagement.postAuthors],
      ['engagement', 'course_enrollments', a.engagement.courseEnrollments],
    ];

    for (const f of a.funnel) {
      rows.push(['funnel', `${f.stage}.count`, f.count]);
      rows.push(['funnel', `${f.stage}.rate_from_top`, f.rateFromTop]);
    }
    for (const c of a.communities) {
      rows.push(['community', `${c.slug}.active_members_7d`, c.activeMembersLast7Days]);
    }
    for (const w of a.cohortRetention?.weekly ?? []) {
      rows.push(['retention_weekly', `${w.period}.retention_rate`, w.retentionRate]);
    }
    for (const m of a.cohortRetention?.monthly ?? []) {
      rows.push(['retention_monthly', `${m.period}.retention_rate`, m.retentionRate]);
    }

    return toCsv(['section', 'key', 'value'], rows);
  }

  private async getSubscriberCohortRetention(creatorId: string) {
    const weeklySince = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);
    const monthlySince = new Date();
    monthlySince.setMonth(monthlySince.getMonth() - 6);

    const cohortSelect = `
      COUNT(*)::int AS cohort_size,
      COUNT(*) FILTER (WHERE s.status IN ('active', 'trial', 'grace_period'))::int AS retained,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM (
            SELECT m.user_id
            FROM channel_messages m
            INNER JOIN channels ch ON ch.id = m.channel_id
            INNER JOIN communities c ON c.id = ch.community_id
            WHERE c.creator_id = $1
              AND m.user_id = s.user_id
              AND m.created_at >= NOW() - INTERVAL '30 days'
              AND m.deleted_at IS NULL
            UNION
            SELECT m.user_id
            FROM community_room_messages m
            INNER JOIN community_rooms r ON r.id = m.room_id
            INNER JOIN communities c ON c.id = r.community_id
            WHERE c.creator_id = $1
              AND m.user_id = s.user_id
              AND m.created_at >= NOW() - INTERVAL '30 days'
              AND m.deleted_at IS NULL
          ) engaged WHERE engaged.user_id = s.user_id
        )
      )::int AS engaged_retained
    `;

    const weeklyRows = await this.dataSource.query<
      { period: string; cohort_size: string; retained: string; engaged_retained: string }[]
    >(
      `SELECT to_char(date_trunc('week', s.starts_at), 'YYYY-MM-DD') AS period,
              ${cohortSelect}
       FROM member_subscriptions s
       WHERE s.creator_id = $1 AND s.starts_at >= $2
       GROUP BY 1 ORDER BY 1`,
      [creatorId, weeklySince],
    );

    const monthlyRows = await this.dataSource.query<
      { period: string; cohort_size: string; retained: string; engaged_retained: string }[]
    >(
      `SELECT to_char(date_trunc('month', s.starts_at), 'YYYY-MM') AS period,
              ${cohortSelect}
       FROM member_subscriptions s
       WHERE s.creator_id = $1 AND s.starts_at >= $2
       GROUP BY 1 ORDER BY 1`,
      [creatorId, monthlySince],
    );

    const mapRows = (rows: typeof weeklyRows) =>
      rows.map((r) => {
        const cohortSize = Number(r.cohort_size);
        const retained = Number(r.retained);
        return {
          period: r.period,
          cohortSize,
          retained,
          engagedRetained: Number(r.engaged_retained),
          retentionRate: cohortSize > 0 ? Math.round((retained / cohortSize) * 100) : 0,
        };
      });

    return {
      weekly: mapRows(weeklyRows),
      monthly: mapRows(monthlyRows),
    };
  }

  async getCommunityLiveStreams(communityId: string, viewerId?: string, viewerRole?: UserRole | null) {
    await this.assertCommunityAccess(communityId, viewerId, viewerRole);
    const streams = await this.streamRepository.find({
      where: { communityId, status: StreamStatus.LIVE },
      order: { startedAt: 'DESC' },
      take: 20,
    });
    return streams.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      viewerCount: s.viewerCount,
      startedAt: s.startedAt,
      playbackUrl: s.playbackUrl,
    }));
  }

  private async getCommunityRetentionMetrics(creatorId: string, communityId: string) {
    const [activeSubsRow] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::int AS count FROM member_subscriptions
       WHERE creator_id = $1 AND status IN ('active', 'trial', 'grace_period')`,
      [creatorId],
    );
    const [xpMembersRow] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(DISTINCT user_id)::int AS count FROM member_xp WHERE community_id = $1`,
      [communityId],
    );
    return {
      activeSubscribers: Number(activeSubsRow?.count ?? 0),
      engagedMembers: Number(xpMembersRow?.count ?? 0),
    };
  }

  async getCommunityPermissionMatrix(
    communityId: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    await this.assertCommunityAccess(communityId, viewerId, viewerRole);
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');

    let effectiveRole: CommunityRoleType | 'owner' | 'member' = 'member';
    if (viewerId) {
      if (community.creatorId === viewerId) {
        effectiveRole = 'owner';
      } else if (viewerRole === UserRole.ADMIN) {
        effectiveRole = CommunityRoleType.ADMIN;
      } else {
        const assignment = await this.roleRepository.findOne({
          where: { communityId, userId: viewerId },
        });
        if (assignment) effectiveRole = assignment.role;
      }
    }

    return {
      communityId,
      permissions: COMMUNITY_PERMISSIONS,
      matrix: COMMUNITY_ROLE_PERMISSION_MATRIX,
      viewerRole: effectiveRole,
      viewerPermissions: permissionsForRole(effectiveRole),
    };
  }

  async getCreatorEcosystemTree(creatorId: string) {
    const [communities, courseRows, programRows, bundleRows, brandRows] = await Promise.all([
      this.communityRepository.find({ where: { creatorId }, order: { name: 'ASC' } }),
      this.dataSource.query<
        Array<{ id: string; title: string; slug: string; community_id: string | null; is_published: boolean }>
      >(
        `SELECT id, title, slug, community_id, is_published
         FROM courses WHERE creator_id = $1 ORDER BY created_at DESC`,
        [creatorId],
      ),
      this.dataSource.query<
        Array<{
          id: string;
          name: string;
          slug: string;
          community_id: string | null;
          is_published: boolean;
          course_count: string;
        }>
      >(
        `SELECT p.id, p.name, p.slug, p.community_id, p.is_published,
                COUNT(pc.course_id)::int AS course_count
         FROM creator_programs p
         LEFT JOIN creator_program_courses pc ON pc.program_id = p.id
         WHERE p.creator_id = $1
         GROUP BY p.id
         ORDER BY p.sort_order ASC, p.created_at DESC`,
        [creatorId],
      ),
      this.dataSource.query<
        Array<{ id: string; name: string; slug: string; is_active: boolean; item_count: string }>
      >(
        `SELECT b.id, b.name, b.slug, b.is_active,
                COUNT(i.id)::int AS item_count
         FROM creator_bundles b
         LEFT JOIN creator_bundle_items i ON i.bundle_id = b.id
         WHERE b.creator_id = $1
         GROUP BY b.id
         ORDER BY b.sort_order ASC, b.created_at DESC`,
        [creatorId],
      ),
      this.dataSource.query<Array<{ id: string; name: string; slug: string }>>(
        `SELECT id, name, slug FROM brands WHERE creator_id = $1 ORDER BY name ASC`,
        [creatorId],
      ),
    ]);

    const coursesByCommunity = new Map<string, typeof courseRows>();
    const standaloneCourses: typeof courseRows = [];
    for (const course of courseRows) {
      if (course.community_id) {
        const list = coursesByCommunity.get(course.community_id) ?? [];
        list.push(course);
        coursesByCommunity.set(course.community_id, list);
      } else {
        standaloneCourses.push(course);
      }
    }

    const programsByCommunity = new Map<string, typeof programRows>();
    const standalonePrograms: typeof programRows = [];
    for (const program of programRows) {
      if (program.community_id) {
        const list = programsByCommunity.get(program.community_id) ?? [];
        list.push(program);
        programsByCommunity.set(program.community_id, list);
      } else {
        standalonePrograms.push(program);
      }
    }

    return {
      data: {
        brands: brandRows,
        communities: communities.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          visibility: c.visibility,
          courses: (coursesByCommunity.get(c.id) ?? []).map((course) => ({
            id: course.id,
            title: course.title,
            slug: course.slug,
            isPublished: course.is_published,
          })),
          programs: (programsByCommunity.get(c.id) ?? []).map((program) => ({
            id: program.id,
            name: program.name,
            slug: program.slug,
            isPublished: program.is_published,
            courseCount: Number(program.course_count ?? 0),
          })),
        })),
        standaloneCourses: standaloneCourses.map((course) => ({
          id: course.id,
          title: course.title,
          slug: course.slug,
          isPublished: course.is_published,
        })),
        programs: standalonePrograms.map((program) => ({
          id: program.id,
          name: program.name,
          slug: program.slug,
          isPublished: program.is_published,
          courseCount: Number(program.course_count ?? 0),
        })),
        bundles: bundleRows.map((bundle) => ({
          id: bundle.id,
          name: bundle.name,
          slug: bundle.slug,
          isActive: bundle.is_active,
          itemCount: Number(bundle.item_count ?? 0),
        })),
      },
    };
  }

  private static readonly MAX_BADGE_TIERS = 5;

  /** Return the creator-configured XP badge tiers for a community. */
  async getBadgeConfig(
    communityId: string,
    creatorId: string,
  ): Promise<Array<{ key: string; label: string; xpThreshold: number; icon: string }>> {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community || community.creatorId !== creatorId) {
      throw new ForbiddenException('Community not found or not owned');
    }
    const tiers = (community.settings?.badgeTiers ?? []) as Array<{
      key: string;
      label: string;
      xpThreshold: number;
      icon: string;
    }>;
    return tiers;
  }

  /** Persist XP-threshold badge tier config for a community (max 5 tiers). */
  async transferCommunityOwnership(
    communityId: string,
    requesterId: string,
    newOwnerId: string,
  ): Promise<{ communityId: string; newOwnerId: string }> {
    if (requesterId === newOwnerId) {
      throw new BadRequestException('New owner must be a different user');
    }

    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (community.creatorId !== requesterId) {
      throw new ForbiddenException('Only the community owner can transfer ownership');
    }

    const newOwnerMembership = await this.communityMemberRepository.findOne({
      where: { communityId, userId: newOwnerId, status: CommunityMemberStatus.ACTIVE },
    });
    if (!newOwnerMembership) {
      throw new BadRequestException('New owner must be an active member of this community');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Community, { id: communityId }, { creatorId: newOwnerId });

      // Give old owner ADMIN role; remove any OWNER role they might have
      await manager.delete(CommunityRole, { communityId, userId: requesterId, role: CommunityRoleType.OWNER });
      const existingOldRole = await manager.findOne(CommunityRole, {
        where: { communityId, userId: requesterId },
      });
      if (!existingOldRole) {
        await manager.save(
          manager.create(CommunityRole, { communityId, userId: requesterId, role: CommunityRoleType.ADMIN }),
        );
      }

      // Give new owner OWNER role; remove any previous role
      await manager.delete(CommunityRole, { communityId, userId: newOwnerId });
      await manager.save(
        manager.create(CommunityRole, { communityId, userId: newOwnerId, role: CommunityRoleType.OWNER }),
      );
    });

    this.eventEmitter.emit('community.ownership.transferred', {
      communityId,
      previousOwnerId: requesterId,
      newOwnerId,
    });
    this.eventEmitter.emit('creator.audit.log', {
      creatorId: requesterId,
      actorId: requesterId,
      action: 'community.transfer_ownership',
      resourceType: 'community',
      resourceId: communityId,
      metadata: { newOwnerId },
    });

    return { communityId, newOwnerId };
  }

  async setBadgeConfig(
    communityId: string,
    creatorId: string,
    tiers: Array<{ key: string; label: string; xpThreshold: number; icon?: string }>,
  ): Promise<Array<{ key: string; label: string; xpThreshold: number; icon: string }>> {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community || community.creatorId !== creatorId) {
      throw new ForbiddenException('Community not found or not owned');
    }
    if (tiers.length > CommunitiesService.MAX_BADGE_TIERS) {
      throw new BadRequestException(`Maximum ${CommunitiesService.MAX_BADGE_TIERS} badge tiers allowed`);
    }

    const normalized = tiers
      .map((t) => ({
        key: t.key.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32),
        label: t.label.slice(0, 64),
        xpThreshold: Math.max(0, Math.floor(t.xpThreshold)),
        icon: t.icon?.slice(0, 8) ?? '🏅',
      }))
      .sort((a, b) => a.xpThreshold - b.xpThreshold);

    community.settings = { ...community.settings, badgeTiers: normalized };
    await this.communityRepository.save(community);
    return normalized;
  }
}
