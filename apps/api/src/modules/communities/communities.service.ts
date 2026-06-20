import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
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
import { Community, CommunityVisibility } from './entities/community.entity';
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
import { ChannelType } from '../entitlements/entities/channel-type.enum';
import { TierEntitlementResourceType } from '../entitlements/entities/tier-entitlement.entity';
import { CommunityModerationQueueService } from './community-moderation-queue.service';
import { Stream, StreamStatus } from '../streaming/entities/stream.entity';
import { UserRole } from '../users/entities/user.entity';

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
    @InjectRepository(ChannelMessage)
    private readonly messageRepository: Repository<ChannelMessage>,
    @InjectRepository(CommunityRole)
    private readonly roleRepository: Repository<CommunityRole>,
    private readonly entitlementsService: EntitlementsService,
    private readonly accessSessionsService: AccessSessionsService,
    @Inject(forwardRef(() => CommunityModerationService))
    private readonly moderationService: CommunityModerationService,
    private readonly aiModerationService: AiModerationService,
    private readonly moderationQueueService: CommunityModerationQueueService,
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
    private readonly dataSource: DataSource,
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

    let membershipActive = false;
    if (viewerId) {
      const membership = await this.entitlementsService.getMembershipForViewer(viewerId, creatorId);
      membershipActive = membership.active;
    }

    const communityIds = communities.map((c) => c.id);
    const viewerRoles = viewerId
      ? await this.roleRepository.find({
          where: { communityId: In(communityIds), userId: viewerId },
        })
      : [];
    const roleByCommunity = new Map(viewerRoles.map((r) => [r.communityId, r]));

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
        membershipActive,
        roleByCommunity.get(community.id),
        inviteChannelsByCommunity.get(community.id) ?? [],
        invitedChannelIds,
      ),
    );
    return visible.map(toPublicCommunity);
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

  async createCommunity(creatorId: string, dto: CreateCommunityDto) {
    const slug =
      dto.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') ||
      dto.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const existing = await this.communityRepository.findOne({ where: { creatorId, slug } });
    if (existing) throw new BadRequestException('Community slug already exists');

    const community = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(Community, {
          creatorId,
          name: dto.name.trim(),
          slug,
          visibility: dto.visibility ?? CommunityVisibility.PUBLIC,
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
    const channel = await this.getOwnedChannel(creatorId, channelId);
    if (dto.name !== undefined) channel.name = dto.name.trim();
    if (dto.type !== undefined) channel.type = dto.type;
    if (dto.requiredTierId !== undefined) channel.requiredTierId = dto.requiredTierId;
    if (dto.categoryId !== undefined) channel.categoryId = dto.categoryId;
    if (dto.sortOrder !== undefined) channel.sortOrder = dto.sortOrder;
    const saved = await this.channelRepository.save(channel);
    return toPublicChannel(saved);
  }

  async inviteMember(creatorId: string, channelId: string, dto: InviteChannelMemberDto) {
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

    return {
      data: data.reverse().map(toPublicChannelMessage),
      meta: { cursor: nextCursor, hasMore },
    };
  }

  async sendChannelMessage(
    channelId: string,
    userId: string,
    dto: SendChannelMessageDto,
    viewerRole?: UserRole | null,
  ) {
    const channel = await this.getChannelWithCommunity(channelId);
    await this.assertChannelAccess(channel, userId, viewerRole);

    if (await this.moderationService.isBanned(channel.community.id, userId)) {
      throw new ForbiddenException('You are banned from this community');
    }

    const spam = this.aiModerationService.scoreSpam(dto.body);
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

    const publicMsg = toPublicChannelMessage(full!);
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

  private async buildCommunityPayload(
    community: Community,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    const canView = await this.canViewCommunity(community, viewerId, viewerRole);
    if (!canView) {
      throw new ForbiddenException('You do not have access to this community');
    }

    const [channels, categories] = await Promise.all([
      this.channelRepository.find({
        where: { communityId: community.id },
        order: { sortOrder: 'ASC' },
      }),
      this.categoryRepository.find({
        where: { communityId: community.id },
        order: { sortOrder: 'ASC' },
      }),
    ]);

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
    membershipActive: boolean,
    role: CommunityRole | undefined,
    inviteChannelIds: string[],
    invitedChannelIds: Set<string>,
  ): boolean {
    const creatorId = community.creatorId;
    if (viewerId === creatorId) return true;
    if (viewerRole === UserRole.ADMIN) return true;

    if (community.visibility === CommunityVisibility.PRIVATE) return false;

    if (community.visibility === CommunityVisibility.PAID) {
      return !!viewerId && membershipActive;
    }

    if (community.visibility === CommunityVisibility.INVITE) {
      if (!viewerId) return false;
      if (role) return true;
      if (membershipActive) return true;
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

    if (community.visibility === CommunityVisibility.PRIVATE) return false;

    if (community.visibility === CommunityVisibility.PAID) {
      if (!viewerId) return false;
      const membership = await this.entitlementsService.getMembershipForViewer(viewerId, creatorId);
      return membership.active;
    }

    if (community.visibility === CommunityVisibility.INVITE) {
      if (!viewerId) return false;
      const role = await this.roleRepository.findOne({
        where: { communityId: community.id, userId: viewerId },
      });
      if (role) return true;
      const membership = await this.entitlementsService.getMembershipForViewer(viewerId, creatorId);
      if (membership.active) return true;
      const inviteChannels = await this.channelRepository.find({
        where: { communityId: community.id, type: ChannelType.INVITE },
        select: ['id'],
      });
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
    const canView = await this.canViewCommunity(community, viewerId, viewerRole);
    if (!canView) throw new ForbiddenException('You do not have access to this community');
    return community;
  }

  async assertOwnedCommunity(creatorId: string, communityId: string): Promise<Community> {
    return this.getOwnedCommunity(creatorId, communityId);
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
      { isOwner, isAdmin },
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

  async searchCommunities(query: string, limit = 20) {
    const term = query.trim();
    if (term.length < 2) return { data: [] };
    const pattern = `%${term}%`;
    const take = Math.min(limit, 50);
    const communities = await this.communityRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.creator', 'creator')
      .where('c.visibility = :visibility', { visibility: CommunityVisibility.PUBLIC })
      .andWhere('(c.name ILIKE :pattern OR c.slug ILIKE :pattern)', { pattern })
      .orderBy('c.created_at', 'DESC')
      .take(take)
      .getMany();

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
      })),
    };
  }

  async getCommunityAnalytics(creatorId: string, communityId: string) {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community || community.creatorId !== creatorId) {
      throw new ForbiddenException('Community not found or not owned');
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [messagesRow] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::int AS count
       FROM channel_messages m
       INNER JOIN channels ch ON ch.id = m.channel_id
       WHERE ch.community_id = $1 AND m.created_at >= $2 AND m.deleted_at IS NULL`,
      [communityId, since],
    );

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
      messagesLast7Days: Number(messagesRow?.count ?? 0),
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
      const [engagedRow] = await this.dataSource.query<{ count: string }[]>(
        `SELECT COUNT(DISTINCT user_id)::int AS count FROM member_xp
         WHERE community_id = ANY($1::uuid[])`,
        [communityIds],
      );
      engagedMembers = Number(engagedRow?.count ?? 0);

      const [chatRow] = await this.dataSource.query<{ count: string }[]>(
        `SELECT COUNT(DISTINCT m.user_id)::int AS count
         FROM channel_messages m
         INNER JOIN channels ch ON ch.id = m.channel_id
         WHERE ch.community_id = ANY($1::uuid[]) AND m.created_at >= $2 AND m.deleted_at IS NULL`,
        [communityIds, since],
      );
      activeChatters = Number(chatRow?.count ?? 0);

      const [postAuthorRow] = await this.dataSource.query<{ count: string }[]>(
        `SELECT COUNT(DISTINCT author_id)::int AS count FROM community_posts
         WHERE community_id = ANY($1::uuid[]) AND created_at >= $2`,
        [communityIds, since],
      );
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

    const communitySummaries = await Promise.all(
      communities.map(async (c) => {
        const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [activeRow] = await this.dataSource.query<{ count: string }[]>(
          `SELECT COUNT(DISTINCT m.user_id)::int AS count
           FROM channel_messages m
           INNER JOIN channels ch ON ch.id = m.channel_id
           WHERE ch.community_id = $1 AND m.created_at >= $2 AND m.deleted_at IS NULL`,
          [c.id, since7],
        );
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          activeMembersLast7Days: Number(activeRow?.count ?? 0),
        };
      }),
    );

    const cohortRetention = await this.getSubscriberCohortRetention(creatorId);

    return {
      periodDays,
      membership: {
        active: membership.active,
        trial: membership.trial,
        canceled: membership.canceled,
        mrrCents: membership.mrrCents,
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

  private async getSubscriberCohortRetention(creatorId: string) {
    const weeklySince = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);
    const monthlySince = new Date();
    monthlySince.setMonth(monthlySince.getMonth() - 6);

    const cohortSelect = `
      COUNT(*)::int AS cohort_size,
      COUNT(*) FILTER (WHERE s.status IN ('active', 'trial', 'grace_period'))::int AS retained,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM channel_messages m
          INNER JOIN channels ch ON ch.id = m.channel_id
          INNER JOIN communities c ON c.id = ch.community_id
          WHERE c.creator_id = $1
            AND m.user_id = s.user_id
            AND m.created_at >= NOW() - INTERVAL '30 days'
            AND m.deleted_at IS NULL
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
}
