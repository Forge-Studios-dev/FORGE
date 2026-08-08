import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  Community,
  CommunityType,
  CommunityVisibility,
  CREATOR_SELECTABLE_COMMUNITY_TYPES,
} from './entities/community.entity';
import { CommunityCategory } from './entities/community-category.entity';
import { Channel } from './entities/channel.entity';
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
  toPublicCommunity,
} from './community.mapper';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { ChannelType } from '../entitlements/entities/channel-type.enum';
import { Stream, StreamStatus } from '../streaming/entities/stream.entity';
import { CommunityRoom } from './entities/community-room.entity';
import { UserRole } from '../users/entities/user.entity';
import {
  CommunityMember,
  CommunityMemberStatus,
} from './entities/community-member.entity';
import { FeatureFlagsService } from '../platform/feature-flags.service';
import {
  COMMUNITY_PERMISSIONS,
  COMMUNITY_ROLE_PERMISSION_MATRIX,
  permissionsForRole,
} from './community-permissions.constants';
import { CHANNELS_DEPRECATED_FLAG } from './community-deprecation.constants';
import { CommunityAccessService } from './community-access.service';
import { CommunityAnalyticsService } from './community-analytics.service';
import { ChannelLegacyService } from './channel-legacy.service';

const DEFAULT_CHANNELS: Array<{ name: string; slug: string; type: ChannelType; sortOrder: number }> = [
  { name: 'Announcements', slug: 'announcements', type: ChannelType.PUBLIC, sortOrder: 0 },
  { name: 'General', slug: 'general', type: ChannelType.PUBLIC, sortOrder: 1 },
  { name: 'Live Discussion', slug: 'live-discussion', type: ChannelType.PUBLIC, sortOrder: 2 },
  { name: 'Premium Content', slug: 'premium-content', type: ChannelType.SUBSCRIBERS, sortOrder: 3 },
];

/**
 * Community lifecycle + read facade.
 *
 * As of C2 in FRESH_AUDIT_2026-07-26 (see docs/audits/IMPLEMENTATION_TRACKER)
 * this service is a thin facade. Access gates, analytics, and deprecated
 * channel paths live in dedicated services:
 *   - CommunityAccessService     — membership/permission checks
 *   - CommunityAnalyticsService  — analytics + CSV exports
 *   - ChannelLegacyService       — @deprecated channel CRUD/messaging (H-A4)
 *
 * The facade keeps public method signatures stable so existing controllers,
 * gateway code, and specs work unchanged; each call forwards to the owning
 * service.
 */
@Injectable()
export class CommunitiesService {
  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityCategory)
    private readonly categoryRepository: Repository<CommunityCategory>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(CommunityMember)
    private readonly communityMemberRepository: Repository<CommunityMember>,
    @InjectRepository(CommunityRole)
    private readonly roleRepository: Repository<CommunityRole>,
    private readonly entitlementsService: EntitlementsService,
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @InjectRepository(CommunityRoom)
    private readonly roomRepository: Repository<CommunityRoom>,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
    private readonly dataSource: DataSource,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly accessService: CommunityAccessService,
    private readonly analyticsService: CommunityAnalyticsService,
    private readonly channelLegacyService: ChannelLegacyService,
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

      await manager.insert(
        Channel,
        DEFAULT_CHANNELS.map((def) => ({ communityId: community.id, ...def })),
      );

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
    if (await this.accessService.isBlockedFromCreator(viewerId, creatorId, viewerRole)) {
      return [];
    }
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

    const invitedChannelIds =
      viewerId && inviteChannelIds.length
        ? await this.accessService.loadInviteMemberChannelIds(viewerId, inviteChannelIds)
        : new Set<string>();

    const inviteChannelsByCommunity = new Map<string, string[]>();
    for (const ch of inviteChannels) {
      const list = inviteChannelsByCommunity.get(ch.communityId) ?? [];
      list.push(ch.id);
      inviteChannelsByCommunity.set(ch.communityId, list);
    }

    const visible = communities.filter((community) =>
      this.accessService.canViewCommunityBatched(
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

      await manager.insert(
        Channel,
        DEFAULT_CHANNELS.map((def) => ({ communityId: created.id, ...def })),
      );

      return created;
    });

    return toPublicCommunity(community);
  }

  async updateCommunity(creatorId: string, communityId: string, dto: UpdateCommunityDto) {
    const community = await this.accessService.assertOwnedCommunity(creatorId, communityId);
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
    await this.accessService.assertOwnedCommunity(creatorId, communityId);
    const categories = await this.categoryRepository.find({
      where: { communityId },
      order: { sortOrder: 'ASC' },
    });
    return categories.map(toPublicCategory);
  }

  async createCategory(creatorId: string, communityId: string, dto: CreateCategoryDto) {
    await this.accessService.assertOwnedCommunity(creatorId, communityId);
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
    await this.accessService.assertOwnedCommunity(creatorId, communityId);
    const category = await this.categoryRepository.findOne({ where: { id: categoryId, communityId } });
    if (!category) throw new NotFoundException('Category not found');
    if (dto.name !== undefined) category.name = dto.name.trim();
    if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;
    const saved = await this.categoryRepository.save(category);
    return toPublicCategory(saved);
  }

  async deleteCategory(creatorId: string, communityId: string, categoryId: string) {
    await this.accessService.assertOwnedCommunity(creatorId, communityId);
    const category = await this.categoryRepository.findOne({ where: { id: categoryId, communityId } });
    if (!category) throw new NotFoundException('Category not found');
    await this.channelRepository.update({ categoryId }, { categoryId: null });
    await this.categoryRepository.delete(categoryId);
    return { deleted: true };
  }

  // --- Legacy channel CRUD & messaging (forwarded to ChannelLegacyService) ---

  /** @deprecated Use CommunityRoomsService.createRoom */
  async createChannel(creatorId: string, dto: CreateChannelDto, communityId?: string) {
    const community = communityId
      ? await this.accessService.assertOwnedCommunity(creatorId, communityId)
      : dto.communityId
        ? await this.accessService.assertOwnedCommunity(creatorId, dto.communityId)
        : await this.ensureDefaultCommunity(creatorId);
    return this.channelLegacyService.createChannel(community, dto);
  }

  /** @deprecated */
  async updateChannel(creatorId: string, channelId: string, dto: UpdateChannelDto) {
    return this.channelLegacyService.updateChannel(creatorId, channelId, dto);
  }

  /** @deprecated */
  async deleteChannel(creatorId: string, channelId: string) {
    return this.channelLegacyService.deleteChannel(creatorId, channelId);
  }

  /** @deprecated */
  async reorderChannels(
    creatorId: string,
    communityId: string,
    channelIds: string[],
  ) {
    const community = await this.accessService.assertOwnedCommunity(creatorId, communityId);
    return this.channelLegacyService.reorderChannels(creatorId, community, channelIds);
  }

  /** @deprecated */
  async inviteMember(creatorId: string, channelId: string, dto: InviteChannelMemberDto) {
    return this.channelLegacyService.inviteMember(creatorId, channelId, dto);
  }

  /** @deprecated */
  async getChannelMessages(
    channelId: string,
    viewerId: string | null | undefined,
    viewerRole: UserRole | null | undefined,
    limit = 50,
    cursor?: string,
    parentId?: string | null,
  ) {
    return this.channelLegacyService.getChannelMessages(
      channelId,
      viewerId,
      viewerRole,
      limit,
      cursor,
      parentId,
    );
  }

  /** @deprecated */
  async sendChannelMessage(
    channelId: string,
    userId: string,
    dto: SendChannelMessageDto,
    viewerRole?: UserRole | null,
  ) {
    return this.channelLegacyService.sendChannelMessage(channelId, userId, dto, viewerRole);
  }

  /** @deprecated */
  async deleteChannelMessage(
    channelId: string,
    messageId: string,
    actorId: string,
    viewerRole?: UserRole | null,
  ) {
    return this.channelLegacyService.deleteChannelMessage(
      channelId,
      messageId,
      actorId,
      viewerRole,
    );
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

  private async buildCommunityPayload(
    community: Community,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    const canView = await this.accessService.canViewCommunity(community, viewerId, viewerRole);
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
        ? await this.accessService.loadInviteMemberChannelIds(viewerId, inviteChannelIds)
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

  // --- Access delegates (forwarded to CommunityAccessService) ---

  async assertCommunityAccess(
    communityId: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ): Promise<Community> {
    return this.accessService.assertCommunityAccess(communityId, viewerId, viewerRole);
  }

  async assertOwnedCommunity(creatorId: string, communityId: string): Promise<Community> {
    return this.accessService.assertOwnedCommunity(creatorId, communityId);
  }

  async assertCommunityStudioAccess(
    actorId: string,
    communityId: string,
    viewerRole?: UserRole | null,
  ): Promise<Community> {
    return this.accessService.assertCommunityStudioAccess(actorId, communityId, viewerRole);
  }

  async assertCanRequestJoin(
    communityId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ): Promise<Community> {
    return this.accessService.assertCanRequestJoin(communityId, userId, viewerRole);
  }

  async canModerateCommunity(
    communityId: string,
    creatorId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ): Promise<boolean> {
    return this.accessService.canModerateCommunity(communityId, creatorId, userId, viewerRole);
  }

  async canCoachCommunity(
    communityId: string,
    creatorId: string,
    userId: string,
    viewerRole?: UserRole | null,
  ): Promise<boolean> {
    return this.accessService.canCoachCommunity(communityId, creatorId, userId, viewerRole);
  }

  async verifyChannelAccess(
    channelId: string,
    viewerId: string | null | undefined,
    viewerRole?: UserRole | null,
  ): Promise<void> {
    return this.accessService.verifyChannelAccess(channelId, viewerId, viewerRole);
  }

  async bustCommunityListCache(userId: string, creatorId: string): Promise<void> {
    return this.accessService.bustCommunityListCache(userId, creatorId);
  }

  async getCommunityAccessMeta(
    creatorId: string,
    slug: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    return this.accessService.getCommunityAccessMeta(creatorId, slug, viewerId, viewerRole);
  }

  // --- Analytics delegates (forwarded to CommunityAnalyticsService) ---

  async getCommunityAnalytics(creatorId: string, communityId: string) {
    return this.analyticsService.getCommunityAnalytics(creatorId, communityId);
  }

  async getCreatorBusinessAnalytics(creatorId: string) {
    return this.analyticsService.getCreatorBusinessAnalytics(creatorId);
  }

  async getCreatorBusinessAnalyticsCsv(creatorId: string): Promise<string> {
    return this.analyticsService.getCreatorBusinessAnalyticsCsv(creatorId);
  }

  async getCreatorAttention(creatorId: string) {
    return this.analyticsService.getCreatorAttention(creatorId);
  }

  async getCreatorEcosystemTree(creatorId: string) {
    return this.analyticsService.getCreatorEcosystemTree(creatorId);
  }

  // --- Remaining community-scoped reads/writes ---

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

  /** Active community IDs the viewer belongs to (membership implies access). */
  async listActiveMemberCommunityIds(userId: string): Promise<string[]> {
    const rows = await this.communityMemberRepository.find({
      where: { userId, status: CommunityMemberStatus.ACTIVE },
      select: { communityId: true },
    });
    return rows.map((r) => r.communityId);
  }

  async getCommunityLiveStreams(communityId: string, viewerId?: string, viewerRole?: UserRole | null) {
    await this.accessService.assertCommunityAccess(communityId, viewerId, viewerRole);
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

  async getCommunityPermissionMatrix(
    communityId: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    await this.accessService.assertCommunityAccess(communityId, viewerId, viewerRole);
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

  /** Persist XP-threshold badge tier config for a community (max 5 tiers). */
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
