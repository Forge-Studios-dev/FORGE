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
    private readonly moderationService: CommunityModerationService,
    private readonly aiModerationService: AiModerationService,
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

    const visible: Community[] = [];
    for (const c of communities) {
      const canView = await this.canViewCommunity(c, viewerId, viewerRole);
      if (canView) visible.push(c);
    }
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

    const community = await this.communityRepository.save(
      this.communityRepository.create({
        creatorId,
        name: dto.name.trim(),
        slug,
        visibility: dto.visibility ?? CommunityVisibility.PUBLIC,
        brandId: dto.brandId ?? null,
      }),
    );

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
}
