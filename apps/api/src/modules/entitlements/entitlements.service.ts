import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { UserRole } from '../users/entities/user.entity';
import { SubscriptionTier } from './entities/subscription-tier.entity';
import {
  MemberSubscription,
  MemberSubscriptionSource,
  MemberSubscriptionStatus,
} from './entities/member-subscription.entity';
import { CreateTierDto, UpdateTierDto, MockSubscriptionDto, AdminGrantSubscriptionDto } from './dto/tier.dto';
import { toPublicTier, toPublicSubscription } from './tier.mapper';
import { EngagementService } from '../engagement/engagement.service';
import { ChannelType } from './entities/channel-type.enum';
import { ContentVisibility, StreamVisibility } from './content-access.types';

export type AccessCheckInput = {
  creatorId: string;
  visibility: string;
  requiredTierId?: string | null;
  viewerId?: string | null;
  isOwner?: boolean;
  isAdmin?: boolean;
};

export type AccessCheckItem = AccessCheckInput;

export type ViewerAccessContext = {
  followingCreatorIds: Set<string>;
  subscriptionsByCreatorId: Map<string, MemberSubscription>;
  tierSortOrderByTierId: Map<string, number>;
};

export type AccessCheckResult = {
  allowed: boolean;
  reason?:
    | 'login_required'
    | 'follow_required'
    | 'subscription_required'
    | 'tier_required'
    | 'invite_required'
    | 'paid_event'
    | 'private'
    | 'not_available';
};

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(SubscriptionTier)
    private readonly tierRepository: Repository<SubscriptionTier>,
    @InjectRepository(MemberSubscription)
    private readonly subscriptionRepository: Repository<MemberSubscription>,
    private readonly engagementService: EngagementService,
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private subscriptionCacheKey(userId: string, creatorId: string): string {
    return `ent:sub:${userId}:${creatorId}`;
  }

  private async bustSubscriptionCache(userId: string, creatorId: string): Promise<void> {
    await this.redis.del(this.subscriptionCacheKey(userId, creatorId));
  }

  async listTiersForCreator(creatorId: string, activeOnly = true) {
    const where = activeOnly ? { creatorId, isActive: true } : { creatorId };
    const tiers = await this.tierRepository.find({
      where,
      order: { sortOrder: 'ASC', priceCents: 'ASC' },
    });
    return tiers.map(toPublicTier);
  }

  async getTierById(tierId: string): Promise<SubscriptionTier> {
    const tier = await this.tierRepository.findOne({ where: { id: tierId } });
    if (!tier) throw new NotFoundException('Tier not found');
    return tier;
  }

  async createTier(creatorId: string, dto: CreateTierDto) {
    const slug =
      dto.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') ||
      dto.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const existing = await this.tierRepository.findOne({ where: { creatorId, slug } });
    if (existing) throw new BadRequestException('Tier slug already exists');

    const maxOrder = await this.tierRepository
      .createQueryBuilder('t')
      .select('MAX(t.sort_order)', 'max')
      .where('t.creator_id = :creatorId', { creatorId })
      .getRawOne<{ max: string | null }>();

    const tier = this.tierRepository.create({
      creatorId,
      name: dto.name.trim(),
      slug,
      priceCents: dto.priceCents ?? 0,
      currency: dto.currency ?? 'INR',
      benefits: dto.benefits ?? [],
      sortOrder: dto.sortOrder ?? (maxOrder?.max ? Number(maxOrder.max) + 1 : 0),
    });
    const saved = await this.tierRepository.save(tier);
    return toPublicTier(saved);
  }

  async updateTier(creatorId: string, tierId: string, dto: UpdateTierDto) {
    const tier = await this.getTierById(tierId);
    if (tier.creatorId !== creatorId) throw new ForbiddenException();

    if (dto.name !== undefined) tier.name = dto.name.trim();
    if (dto.priceCents !== undefined) tier.priceCents = dto.priceCents;
    if (dto.benefits !== undefined) tier.benefits = dto.benefits;
    if (dto.sortOrder !== undefined) tier.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) tier.isActive = dto.isActive;

    const saved = await this.tierRepository.save(tier);
    return toPublicTier(saved);
  }

  async deleteTier(creatorId: string, tierId: string) {
    const tier = await this.getTierById(tierId);
    if (tier.creatorId !== creatorId) throw new ForbiddenException();
    tier.isActive = false;
    await this.tierRepository.save(tier);
    return { ok: true };
  }

  async getActiveSubscription(userId: string, creatorId: string): Promise<MemberSubscription | null> {
    const cacheKey = this.subscriptionCacheKey(userId, creatorId);
    const cached = await this.redis.get(cacheKey);
    if (cached === 'none') return null;
    if (cached && cached !== 'none') {
      try {
        const parsed = JSON.parse(cached) as MemberSubscription;
        if (parsed.expiresAt && new Date(parsed.expiresAt) <= new Date()) {
          await this.redis.del(cacheKey);
        } else {
          return parsed;
        }
      } catch {
        await this.redis.del(cacheKey);
      }
    }

    const now = new Date();
    const sub = await this.subscriptionRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.tier', 'tier')
      .where('s.user_id = :userId', { userId })
      .andWhere('s.creator_id = :creatorId', { creatorId })
      .andWhere('s.status = :status', { status: MemberSubscriptionStatus.ACTIVE })
      .andWhere('s.starts_at <= :now', { now })
      .andWhere('(s.expires_at IS NULL OR s.expires_at > :now)', { now })
      .orderBy('s.created_at', 'DESC')
      .getOne();

    await this.redis.setex(cacheKey, 60, sub ? JSON.stringify(sub) : 'none');
    return sub;
  }

  async getMembershipForViewer(userId: string, creatorId: string) {
    const sub = await this.getActiveSubscription(userId, creatorId);
    if (!sub) return { active: false as const };
    return {
      active: true as const,
      subscription: toPublicSubscription(sub),
      isTestMembership:
        sub.source === MemberSubscriptionSource.MOCK ||
        sub.source === MemberSubscriptionSource.ADMIN_GRANT,
    };
  }

  async hasActiveSubscription(userId: string, creatorId: string): Promise<boolean> {
    const sub = await this.getActiveSubscription(userId, creatorId);
    return !!sub;
  }

  async meetsTierRequirement(
    userId: string,
    creatorId: string,
    requiredTierId: string,
  ): Promise<boolean> {
    const sub = await this.getActiveSubscription(userId, creatorId);
    if (!sub?.tier) return false;

    const requiredTier = await this.getTierById(requiredTierId);
    if (requiredTier.creatorId !== creatorId) return false;

    return sub.tier.sortOrder >= requiredTier.sortOrder;
  }

  /** Alias for checkAccess — single entry point for entitlement checks. */
  hasAccess(input: AccessCheckInput): Promise<AccessCheckResult> {
    return this.checkAccess(input);
  }

  /**
   * Batch entitlement resolution for list endpoints (e.g. live streams — F-502).
   * Uses one follow query + one subscription query per unique creator set.
   */
  async checkAccessMany(
    viewerId: string | null | undefined,
    viewerRole: UserRole | null | undefined,
    items: AccessCheckItem[],
  ): Promise<AccessCheckResult[]> {
    if (items.length === 0) return [];
    const isGlobalAdmin = viewerRole === UserRole.ADMIN;
    const needsContext = items.some(
      (item) =>
        !item.isOwner &&
        !isGlobalAdmin &&
        !item.isAdmin &&
        item.visibility !== ContentVisibility.PUBLIC &&
        item.visibility !== ContentVisibility.UNLISTED,
    );

    let ctx: ViewerAccessContext | null = null;
    if (needsContext && viewerId) {
      const creatorIds = [...new Set(items.map((i) => i.creatorId))];
      const tierIds = items
        .map((i) =>
          i.visibility === ContentVisibility.TIER || i.visibility === StreamVisibility.TIER
            ? i.requiredTierId
            : null,
        )
        .filter((id): id is string => !!id);
      ctx = await this.buildViewerAccessContext(viewerId, creatorIds, tierIds);
    }

    return items.map((item) => {
      const input: AccessCheckInput = {
        ...item,
        viewerId: item.viewerId ?? viewerId,
        isAdmin: item.isAdmin ?? isGlobalAdmin,
      };
      if (ctx && input.viewerId) {
        return this.evaluateAccessWithContext(input, ctx);
      }
      return this.evaluateAccessQuick(input);
    });
  }

  private evaluateAccessQuick(input: AccessCheckInput): AccessCheckResult {
    const { visibility, viewerId, isOwner, isAdmin } = input;
    if (isOwner || isAdmin) return { allowed: true };
    if (visibility === ContentVisibility.PUBLIC || visibility === ContentVisibility.UNLISTED) {
      return { allowed: true };
    }
    if (!viewerId) return { allowed: false, reason: 'login_required' };
    return { allowed: false, reason: 'not_available' };
  }

  private async buildViewerAccessContext(
    viewerId: string,
    creatorIds: string[],
    requiredTierIds: string[],
  ): Promise<ViewerAccessContext> {
    const [followingCreatorIds, subscriptionsByCreatorId, tierSortOrderByTierId] = await Promise.all([
      this.engagementService.getFollowingIdsAmong(viewerId, creatorIds),
      this.loadActiveSubscriptionsForCreators(viewerId, creatorIds),
      this.loadTierSortOrders(requiredTierIds),
    ]);
    return { followingCreatorIds, subscriptionsByCreatorId, tierSortOrderByTierId };
  }

  private async loadActiveSubscriptionsForCreators(
    userId: string,
    creatorIds: string[],
  ): Promise<Map<string, MemberSubscription>> {
    const unique = [...new Set(creatorIds.filter(Boolean))];
    const map = new Map<string, MemberSubscription>();
    if (unique.length === 0) return map;

    const now = new Date();
    const subs = await this.subscriptionRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.tier', 'tier')
      .where('s.user_id = :userId', { userId })
      .andWhere('s.creator_id IN (:...creatorIds)', { creatorIds: unique })
      .andWhere('s.status = :status', { status: MemberSubscriptionStatus.ACTIVE })
      .andWhere('s.starts_at <= :now', { now })
      .andWhere('(s.expires_at IS NULL OR s.expires_at > :now)', { now })
      .orderBy('s.created_at', 'DESC')
      .getMany();

    for (const sub of subs) {
      if (!map.has(sub.creatorId)) {
        map.set(sub.creatorId, sub);
        await this.redis.setex(this.subscriptionCacheKey(userId, sub.creatorId), 60, JSON.stringify(sub));
      }
    }
    for (const creatorId of unique) {
      if (!map.has(creatorId)) {
        await this.redis.setex(this.subscriptionCacheKey(userId, creatorId), 60, 'none');
      }
    }
    return map;
  }

  private async loadTierSortOrders(tierIds: string[]): Promise<Map<string, number>> {
    const unique = [...new Set(tierIds.filter(Boolean))];
    const map = new Map<string, number>();
    if (unique.length === 0) return map;
    const tiers = await this.tierRepository.find({ where: { id: In(unique) } });
    for (const tier of tiers) {
      map.set(tier.id, tier.sortOrder);
    }
    return map;
  }

  private evaluateAccessWithContext(
    input: AccessCheckInput,
    ctx: ViewerAccessContext,
  ): AccessCheckResult {
    const { creatorId, visibility, requiredTierId, viewerId, isOwner, isAdmin } = input;

    if (isOwner || isAdmin) return { allowed: true };

    if (visibility === ContentVisibility.PUBLIC || visibility === ContentVisibility.UNLISTED) {
      return { allowed: true };
    }

    if (!viewerId) return { allowed: false, reason: 'login_required' };

    if (visibility === ContentVisibility.PRIVATE) {
      return { allowed: false, reason: 'private' };
    }

    if (visibility === ContentVisibility.PAID_EVENT) {
      return { allowed: false, reason: 'paid_event' };
    }

    if (visibility === ContentVisibility.FOLLOWERS || visibility === StreamVisibility.FOLLOWERS) {
      return ctx.followingCreatorIds.has(creatorId)
        ? { allowed: true }
        : { allowed: false, reason: 'follow_required' };
    }

    if (visibility === ContentVisibility.SUBSCRIBERS || visibility === StreamVisibility.SUBSCRIBERS) {
      return ctx.subscriptionsByCreatorId.has(creatorId)
        ? { allowed: true }
        : { allowed: false, reason: 'subscription_required' };
    }

    if (visibility === ContentVisibility.TIER || visibility === StreamVisibility.TIER) {
      const sub = ctx.subscriptionsByCreatorId.get(creatorId);
      if (!requiredTierId) {
        return sub ? { allowed: true } : { allowed: false, reason: 'tier_required' };
      }
      const requiredOrder = ctx.tierSortOrderByTierId.get(requiredTierId);
      if (requiredOrder === undefined || !sub?.tier) {
        return { allowed: false, reason: 'tier_required' };
      }
      return sub.tier.sortOrder >= requiredOrder
        ? { allowed: true }
        : { allowed: false, reason: 'tier_required' };
    }

    return { allowed: false, reason: 'not_available' };
  }

  async checkAccess(input: AccessCheckInput): Promise<AccessCheckResult> {
    const { creatorId, visibility, requiredTierId, viewerId, isOwner, isAdmin } = input;

    if (isOwner || isAdmin) return { allowed: true };

    if (visibility === ContentVisibility.PUBLIC || visibility === ContentVisibility.UNLISTED) {
      return { allowed: true };
    }

    if (!viewerId) {
      return { allowed: false, reason: 'login_required' };
    }

    if (visibility === ContentVisibility.PRIVATE) {
      return { allowed: false, reason: 'private' };
    }

    if (visibility === ContentVisibility.PAID_EVENT) {
      return { allowed: false, reason: 'paid_event' };
    }

    if (visibility === ContentVisibility.FOLLOWERS || visibility === StreamVisibility.FOLLOWERS) {
      const following = await this.engagementService.isFollowing(viewerId, creatorId);
      return following ? { allowed: true } : { allowed: false, reason: 'follow_required' };
    }

    if (visibility === ContentVisibility.SUBSCRIBERS || visibility === StreamVisibility.SUBSCRIBERS) {
      const hasSub = await this.hasActiveSubscription(viewerId, creatorId);
      return hasSub ? { allowed: true } : { allowed: false, reason: 'subscription_required' };
    }

    if (visibility === ContentVisibility.TIER || visibility === StreamVisibility.TIER) {
      if (!requiredTierId) {
        const hasSub = await this.hasActiveSubscription(viewerId, creatorId);
        return hasSub ? { allowed: true } : { allowed: false, reason: 'tier_required' };
      }
      const meets = await this.meetsTierRequirement(viewerId, creatorId, requiredTierId);
      return meets ? { allowed: true } : { allowed: false, reason: 'tier_required' };
    }

    return { allowed: false, reason: 'not_available' };
  }

  assertAccess(input: AccessCheckInput): void {
    const result = this.checkAccessSync(input);
    if (!result.allowed) {
      const messages: Record<string, string> = {
        login_required: 'Sign in to access this content',
        follow_required: 'Follow this creator to access this content',
        subscription_required: 'An active membership is required',
        tier_required: 'A higher membership tier is required',
        invite_required: 'You are not invited to this channel',
        paid_event: 'Paid event access is not available yet',
        private: 'This content is private',
        not_available: 'This content is not available',
      };
      throw new ForbiddenException(messages[result.reason ?? 'not_available']);
    }
  }

  /** Sync wrapper when async checks already done */
  checkAccessSync(input: AccessCheckInput & { precomputed?: AccessCheckResult }): AccessCheckResult {
    if (input.precomputed) return input.precomputed;
    throw new Error('Use checkAccess() for async entitlement checks');
  }

  async assertAccessAsync(input: AccessCheckInput): Promise<void> {
    const result = await this.checkAccess(input);
    if (!result.allowed) {
      const messages: Record<string, string> = {
        login_required: 'Sign in to access this content',
        follow_required: 'Follow this creator to access this content',
        subscription_required: 'An active membership is required',
        tier_required: 'A higher membership tier is required',
        invite_required: 'You are not invited to this channel',
        paid_event: 'Paid event access is not available yet',
        private: 'This content is private',
        not_available: 'This content is not available',
      };
      throw new ForbiddenException(messages[result.reason ?? 'not_available']);
    }
  }

  async checkChannelAccess(
    viewerId: string | null | undefined,
    channel: {
      type: ChannelType;
      requiredTierId?: string | null;
      creatorId: string;
      isMember?: boolean;
    },
    opts?: { isOwner?: boolean; isAdmin?: boolean },
  ): Promise<AccessCheckResult> {
    if (opts?.isOwner || opts?.isAdmin) return { allowed: true };

    if (channel.type === ChannelType.PUBLIC) return { allowed: true };

    if (channel.type === ChannelType.INVITE) {
      if (!viewerId) return { allowed: false, reason: 'login_required' };
      return channel.isMember
        ? { allowed: true }
        : { allowed: false, reason: 'invite_required' };
    }

    if (channel.type === ChannelType.SUBSCRIBERS) {
      return this.checkAccess({
        creatorId: channel.creatorId,
        visibility: ContentVisibility.SUBSCRIBERS,
        viewerId,
      });
    }

    if (channel.type === ChannelType.TIER) {
      return this.checkAccess({
        creatorId: channel.creatorId,
        visibility: ContentVisibility.TIER,
        requiredTierId: channel.requiredTierId,
        viewerId,
      });
    }

    return { allowed: false, reason: 'not_available' };
  }

  async grantSubscription(
    userId: string,
    dto: MockSubscriptionDto | AdminGrantSubscriptionDto,
    source: MemberSubscriptionSource,
  ) {
    const tier = await this.getTierById(dto.tierId);
    if (tier.creatorId !== dto.creatorId) {
      throw new BadRequestException('Tier does not belong to creator');
    }

    const creatorId = dto.creatorId;
    let expiresAt: Date | null = null;
    if (dto.expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + dto.expiresInDays);
    }

    await this.subscriptionRepository.update(
      { userId, creatorId, status: MemberSubscriptionStatus.ACTIVE },
      { status: MemberSubscriptionStatus.CANCELED },
    );

    const sub = this.subscriptionRepository.create({
      userId,
      creatorId,
      tierId: dto.tierId,
      status: MemberSubscriptionStatus.ACTIVE,
      source,
      startsAt: new Date(),
      expiresAt,
    });
    const saved = await this.subscriptionRepository.save(sub);
    await this.bustSubscriptionCache(userId, creatorId);
    const full = await this.subscriptionRepository.findOne({
      where: { id: saved.id },
      relations: ['tier'],
    });
    return toPublicSubscription(full!);
  }

  async listActiveSubscriberUserIds(
    creatorId: string,
    requiredTierId?: string | null,
  ): Promise<string[]> {
    const now = new Date();
    const subs = await this.subscriptionRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.tier', 'tier')
      .where('s.creator_id = :creatorId', { creatorId })
      .andWhere('s.status = :status', { status: MemberSubscriptionStatus.ACTIVE })
      .andWhere('s.starts_at <= :now', { now })
      .andWhere('(s.expires_at IS NULL OR s.expires_at > :now)', { now })
      .getMany();

    if (!requiredTierId) {
      return subs.map((s) => s.userId);
    }

    const requiredTier = await this.getTierById(requiredTierId);
    if (requiredTier.creatorId !== creatorId) return [];

    return subs
      .filter((s) => s.tier && s.tier.sortOrder >= requiredTier.sortOrder)
      .map((s) => s.userId);
  }

  async mockSubscribe(requesterId: string, dto: MockSubscriptionDto) {
    const enabled = this.configService.get<boolean>('entitlements.mockSubscriptionsEnabled');
    if (!enabled) {
      throw new ForbiddenException('Mock subscriptions are disabled');
    }
    return this.grantSubscription(requesterId, dto, MemberSubscriptionSource.MOCK);
  }

  async adminGrantSubscription(dto: AdminGrantSubscriptionDto) {
    return this.grantSubscription(dto.userId, dto, MemberSubscriptionSource.ADMIN_GRANT);
  }

  async listMySubscriptions(userId: string) {
    const subs = await this.subscriptionRepository.find({
      where: { userId, status: MemberSubscriptionStatus.ACTIVE },
      relations: ['tier', 'creator'],
      order: { createdAt: 'DESC' },
    });
    return subs.map(toPublicSubscription);
  }

  async expireDueSubscriptions(): Promise<number> {
    const now = new Date();
    const result = await this.subscriptionRepository.update(
      {
        status: MemberSubscriptionStatus.ACTIVE,
        expiresAt: LessThanOrEqual(now),
      },
      { status: MemberSubscriptionStatus.EXPIRED },
    );
    return result.affected ?? 0;
  }

  async getExpiringSubscriptions(withinDays = 3): Promise<MemberSubscription[]> {
    const now = new Date();
    const until = new Date();
    until.setDate(until.getDate() + withinDays);

    return this.subscriptionRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.tier', 'tier')
      .leftJoinAndSelect('s.creator', 'creator')
      .where('s.status = :status', { status: MemberSubscriptionStatus.ACTIVE })
      .andWhere('s.expires_at IS NOT NULL')
      .andWhere('s.expires_at > :now', { now })
      .andWhere('s.expires_at <= :until', { until })
      .getMany();
  }

  slugify(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  }
}
