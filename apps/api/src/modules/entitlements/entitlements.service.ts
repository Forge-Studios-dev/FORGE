import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository, LessThanOrEqual, DataSource } from 'typeorm';
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
import { StreamEventPurchase } from '../streaming/entities/stream-event-purchase.entity';
import { TierEntitlement, TierEntitlementResourceType } from './entities/tier-entitlement.entity';
import { BillingInterval } from './entities/subscription-tier.entity';
import { StripeTierSyncService } from '../billing/stripe-tier-sync.service';

/** Subscription statuses that grant content access. */
export const ACCESS_GRANTING_STATUSES: MemberSubscriptionStatus[] = [
  MemberSubscriptionStatus.ACTIVE,
  MemberSubscriptionStatus.TRIAL,
  MemberSubscriptionStatus.GRACE_PERIOD,
  MemberSubscriptionStatus.RENEWAL_PENDING,
];

export type AccessCheckInput = {
  creatorId: string;
  visibility: string;
  requiredTierId?: string | null;
  streamId?: string | null;
  viewerId?: string | null;
  isOwner?: boolean;
  isAdmin?: boolean;
};

export type AccessCheckItem = AccessCheckInput;

export type ViewerAccessContext = {
  followingCreatorIds: Set<string>;
  subscriptionsByCreatorId: Map<string, MemberSubscription>;
  tierSortOrderByTierId: Map<string, number>;
  purchasedStreamIds: Set<string>;
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
    | 'not_available'
    | 'age_confirmation_required';
};

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(SubscriptionTier)
    private readonly tierRepository: Repository<SubscriptionTier>,
    @InjectRepository(MemberSubscription)
    private readonly subscriptionRepository: Repository<MemberSubscription>,
    @InjectRepository(StreamEventPurchase)
    private readonly streamPurchaseRepository: Repository<StreamEventPurchase>,
    @InjectRepository(TierEntitlement)
    private readonly tierEntitlementRepository: Repository<TierEntitlement>,
    private readonly engagementService: EngagementService,
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
    private readonly dataSource: DataSource,
    @Optional() @Inject(forwardRef(() => StripeTierSyncService))
    private readonly stripeTierSync?: StripeTierSyncService,
  ) {}

  private subscriptionCacheKey(userId: string, creatorId: string): string {
    return `ent:sub:${userId}:${creatorId}`;
  }

  private tierCacheKey(tierId: string): string {
    return `ent:tier:${tierId}`;
  }

  private viewerAccessCacheKey(userId: string, creatorId: string): string {
    return `ent:access:${userId}:${creatorId}`;
  }

  private accessCacheField(visibility: string, requiredTierId?: string | null): string {
    return `${visibility}:${requiredTierId ?? 'none'}`;
  }

  private async bustSubscriptionCache(userId: string, creatorId: string): Promise<void> {
    await Promise.all([
      this.redis.del(this.subscriptionCacheKey(userId, creatorId)),
      this.redis.del(this.viewerAccessCacheKey(userId, creatorId)),
    ]);
  }

  private async bustTierCache(tierId: string): Promise<void> {
    await this.redis.del(this.tierCacheKey(tierId));
  }

  private async readCachedAccess(
    viewerId: string,
    creatorId: string,
    field: string,
  ): Promise<AccessCheckResult | null> {
    const cachedBlob = await this.redis.get(this.viewerAccessCacheKey(viewerId, creatorId));
    if (!cachedBlob) return null;
    try {
      const map = JSON.parse(cachedBlob) as Record<string, AccessCheckResult>;
      return map[field] ?? null;
    } catch {
      await this.redis.del(this.viewerAccessCacheKey(viewerId, creatorId));
      return null;
    }
  }

  private async writeCachedAccess(
    viewerId: string,
    creatorId: string,
    field: string,
    result: AccessCheckResult,
  ): Promise<void> {
    const cacheKey = this.viewerAccessCacheKey(viewerId, creatorId);
    let map: Record<string, AccessCheckResult> = {};
    const existing = await this.redis.get(cacheKey);
    if (existing) {
      try {
        map = JSON.parse(existing) as Record<string, AccessCheckResult>;
      } catch {
        map = {};
      }
    }
    map[field] = result;
    await this.redis.setex(cacheKey, 60, JSON.stringify(map));
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
    const cacheKey = this.tierCacheKey(tierId);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as SubscriptionTier;
        return Object.assign(new SubscriptionTier(), parsed);
      } catch {
        await this.redis.del(cacheKey);
      }
    }

    const tier = await this.tierRepository.findOne({ where: { id: tierId } });
    if (!tier) throw new NotFoundException('Tier not found');
    await this.redis.setex(cacheKey, 300, JSON.stringify(tier));
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
      billingInterval: dto.billingInterval ?? BillingInterval.MONTHLY,
      trialDays: dto.trialDays ?? 0,
    });
    const saved = await this.tierRepository.save(tier);
    await this.syncTierToStripe(saved);
    return toPublicTier(saved);
  }

  private async syncTierToStripe(tier: SubscriptionTier): Promise<void> {
    if (!this.stripeTierSync?.isEnabled()) return;
    const synced = await this.stripeTierSync.syncTier(tier);
    if (synced) {
      tier.stripeProductId = synced.productId;
      tier.stripePriceId = synced.priceId;
      await this.tierRepository.save(tier);
      await this.bustTierCache(tier.id);
    }
  }

  async updateTierStripeIds(tierId: string, productId: string, priceId: string) {
    await this.tierRepository.update(tierId, {
      stripeProductId: productId,
      stripePriceId: priceId,
    });
    await this.bustTierCache(tierId);
  }

  async updateTier(creatorId: string, tierId: string, dto: UpdateTierDto) {
    const tier = await this.getTierById(tierId);
    if (tier.creatorId !== creatorId) throw new ForbiddenException();

    if (dto.name !== undefined) tier.name = dto.name.trim();
    if (dto.priceCents !== undefined) tier.priceCents = dto.priceCents;
    if (dto.benefits !== undefined) tier.benefits = dto.benefits;
    if (dto.sortOrder !== undefined) tier.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) tier.isActive = dto.isActive;
    if (dto.billingInterval !== undefined) tier.billingInterval = dto.billingInterval;
    if (dto.trialDays !== undefined) tier.trialDays = dto.trialDays;

    const saved = await this.tierRepository.save(tier);
    await this.bustTierCache(tierId);
    await this.syncTierToStripe(saved);
    return toPublicTier(saved);
  }

  async deleteTier(creatorId: string, tierId: string) {
    const tier = await this.getTierById(tierId);
    if (tier.creatorId !== creatorId) throw new ForbiddenException();
    tier.isActive = false;
    await this.tierRepository.save(tier);
    await this.bustTierCache(tierId);
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
      .andWhere('s.status IN (:...statuses)', { statuses: ACCESS_GRANTING_STATUSES })
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
      const paidStreamIds = items
        .filter((i) => i.visibility === ContentVisibility.PAID_EVENT && i.streamId)
        .map((i) => i.streamId!)
        .filter(Boolean);
      ctx = await this.buildViewerAccessContext(viewerId, creatorIds, tierIds, paidStreamIds);
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
    paidStreamIds: string[] = [],
  ): Promise<ViewerAccessContext> {
    const [followingCreatorIds, subscriptionsByCreatorId, tierSortOrderByTierId, purchasedStreamIds] =
      await Promise.all([
        this.engagementService.getFollowingIdsAmong(viewerId, creatorIds),
        this.loadActiveSubscriptionsForCreators(viewerId, creatorIds),
        this.loadTierSortOrders(requiredTierIds),
        this.loadPurchasedStreamIds(viewerId, paidStreamIds),
      ]);
    return { followingCreatorIds, subscriptionsByCreatorId, tierSortOrderByTierId, purchasedStreamIds };
  }

  private async loadPurchasedStreamIds(
    userId: string,
    streamIds: string[],
  ): Promise<Set<string>> {
    const unique = [...new Set(streamIds.filter(Boolean))];
    const set = new Set<string>();
    if (unique.length === 0) return set;
    const rows = await this.streamPurchaseRepository.find({
      where: unique.map((streamId) => ({ streamId, userId, status: 'completed' })),
      select: ['streamId'],
    });
    for (const row of rows) set.add(row.streamId);
    return set;
  }

  private async checkPaidEventAccess(input: AccessCheckInput): Promise<AccessCheckResult> {
    const { viewerId, streamId, isOwner, isAdmin } = input;
    if (isOwner || isAdmin) return { allowed: true };
    if (!viewerId) return { allowed: false, reason: 'login_required' };
    if (!streamId) return { allowed: false, reason: 'paid_event' };
    const purchased = await this.streamPurchaseRepository.findOne({
      where: { streamId, userId: viewerId, status: 'completed' },
    });
    return purchased ? { allowed: true } : { allowed: false, reason: 'paid_event' };
  }

  private evaluatePaidEventAccess(
    input: AccessCheckInput,
    ctx: ViewerAccessContext,
  ): AccessCheckResult {
    const { streamId, viewerId } = input;
    if (!streamId) return { allowed: false, reason: 'paid_event' };
    if (!viewerId) return { allowed: false, reason: 'login_required' };
    return ctx.purchasedStreamIds.has(streamId)
      ? { allowed: true }
      : { allowed: false, reason: 'paid_event' };
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
      .andWhere('s.status IN (:...statuses)', { statuses: ACCESS_GRANTING_STATUSES })
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
    await Promise.all(
      unique.map(async (tierId) => {
        try {
          const tier = await this.getTierById(tierId);
          map.set(tierId, tier.sortOrder);
        } catch {
          /* missing tier — skip */
        }
      }),
    );
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
      return this.evaluatePaidEventAccess(input, ctx);
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
      return this.checkPaidEventAccess(input);
    }

    const cacheField = this.accessCacheField(visibility, requiredTierId);
    const cached = await this.readCachedAccess(viewerId, creatorId, cacheField);
    if (cached) return cached;

    let result: AccessCheckResult;

    if (visibility === ContentVisibility.FOLLOWERS || visibility === StreamVisibility.FOLLOWERS) {
      const following = await this.engagementService.isFollowing(viewerId, creatorId);
      result = following ? { allowed: true } : { allowed: false, reason: 'follow_required' };
    } else if (
      visibility === ContentVisibility.SUBSCRIBERS ||
      visibility === StreamVisibility.SUBSCRIBERS
    ) {
      const hasSub = await this.hasActiveSubscription(viewerId, creatorId);
      result = hasSub ? { allowed: true } : { allowed: false, reason: 'subscription_required' };
    } else if (visibility === ContentVisibility.TIER || visibility === StreamVisibility.TIER) {
      if (!requiredTierId) {
        const hasSub = await this.hasActiveSubscription(viewerId, creatorId);
        result = hasSub ? { allowed: true } : { allowed: false, reason: 'tier_required' };
      } else {
        const meets = await this.meetsTierRequirement(viewerId, creatorId, requiredTierId);
        result = meets ? { allowed: true } : { allowed: false, reason: 'tier_required' };
      }
    } else {
      return { allowed: false, reason: 'not_available' };
    }

    await this.writeCachedAccess(viewerId, creatorId, cacheField, result);
    return result;
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
        paid_event: 'Purchase a ticket to access this paid event',
        private: 'This content is private',
        not_available: 'This content is not available',
        age_confirmation_required: 'Confirm you are 18 or older to view this content',
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
        paid_event: 'Purchase a ticket to access this paid event',
        private: 'This content is private',
        not_available: 'This content is not available',
        age_confirmation_required: 'Confirm you are 18 or older to view this content',
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
      communityId?: string | null;
      channelId?: string | null;
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

    let result: AccessCheckResult;
    if (channel.type === ChannelType.SUBSCRIBERS) {
      result = await this.checkAccess({
        creatorId: channel.creatorId,
        visibility: ContentVisibility.SUBSCRIBERS,
        viewerId,
      });
    } else if (channel.type === ChannelType.TIER) {
      result = await this.checkAccess({
        creatorId: channel.creatorId,
        visibility: ContentVisibility.TIER,
        requiredTierId: channel.requiredTierId,
        viewerId,
      });
    } else {
      return { allowed: false, reason: 'not_available' };
    }

    if (!result.allowed || !viewerId) return result;
    const entitled = await this.verifyChannelTierEntitlements(
      viewerId,
      channel.creatorId,
      channel.communityId,
      channel.channelId,
    );
    return entitled ? result : { allowed: false, reason: 'tier_required' };
  }

  private async verifyChannelTierEntitlements(
    viewerId: string,
    creatorId: string,
    communityId?: string | null,
    channelId?: string | null,
  ): Promise<boolean> {
    if (channelId) {
      const byChannel = await this.hasTierEntitlement(
        viewerId,
        creatorId,
        TierEntitlementResourceType.CHANNEL,
        channelId,
      );
      if (byChannel) return true;
    }
    if (communityId) {
      return this.hasTierEntitlement(
        viewerId,
        creatorId,
        TierEntitlementResourceType.COMMUNITY,
        communityId,
      );
    }
    return true;
  }

  /** Batch channel gates for community lists (F-503) — one checkAccessMany for tier/subscriber channels. */
  async checkChannelAccessMany(
    viewerId: string | null | undefined,
    viewerRole: UserRole | null | undefined,
    channels: Array<{
      type: ChannelType;
      requiredTierId?: string | null;
      creatorId: string;
      communityId?: string | null;
      channelId?: string | null;
      isMember?: boolean;
    }>,
    opts?: { isOwner?: boolean; isAdmin?: boolean },
  ): Promise<AccessCheckResult[]> {
    if (opts?.isOwner || opts?.isAdmin) {
      return channels.map(() => ({ allowed: true }));
    }

    const results: (AccessCheckResult | null)[] = channels.map(() => null);
    const batchItems: AccessCheckItem[] = [];
    const batchIndices: number[] = [];

    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i];
      if (channel.type === ChannelType.PUBLIC) {
        results[i] = { allowed: true };
        continue;
      }
      if (channel.type === ChannelType.INVITE) {
        if (!viewerId) results[i] = { allowed: false, reason: 'login_required' };
        else {
          results[i] = channel.isMember
            ? { allowed: true }
            : { allowed: false, reason: 'invite_required' };
        }
        continue;
      }
      if (channel.type === ChannelType.SUBSCRIBERS) {
        batchIndices.push(i);
        batchItems.push({
          creatorId: channel.creatorId,
          visibility: ContentVisibility.SUBSCRIBERS,
          viewerId,
        });
        continue;
      }
      if (channel.type === ChannelType.TIER) {
        batchIndices.push(i);
        batchItems.push({
          creatorId: channel.creatorId,
          visibility: ContentVisibility.TIER,
          requiredTierId: channel.requiredTierId,
          viewerId,
        });
        continue;
      }
      results[i] = { allowed: false, reason: 'not_available' };
    }

    if (batchItems.length > 0) {
      const access = await this.checkAccessMany(viewerId, viewerRole, batchItems);
      batchIndices.forEach((channelIdx, j) => {
        results[channelIdx] = access[j];
      });
    }

    if (viewerId) {
      for (let i = 0; i < channels.length; i++) {
        const r = results[i];
        if (!r?.allowed) continue;
        const ch = channels[i];
        if (ch.type === ChannelType.PUBLIC || ch.type === ChannelType.INVITE) continue;
        const entitled = await this.verifyChannelTierEntitlements(
          viewerId,
          ch.creatorId,
          ch.communityId,
          ch.channelId,
        );
        if (!entitled) results[i] = { allowed: false, reason: 'tier_required' };
      }
    }

    return results as AccessCheckResult[];
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

    const saved = await this.dataSource.transaction(async (manager) => {
      await manager.update(
        MemberSubscription,
        { userId, creatorId, status: MemberSubscriptionStatus.ACTIVE },
        { status: MemberSubscriptionStatus.CANCELED },
      );

      return manager.save(
        manager.create(MemberSubscription, {
          userId,
          creatorId,
          tierId: dto.tierId,
          status: MemberSubscriptionStatus.ACTIVE,
          source,
          startsAt: new Date(),
          expiresAt,
          externalRef: dto.externalSubscriptionId ?? null,
        }),
      );
    });

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
      .andWhere('s.status IN (:...statuses)', { statuses: ACCESS_GRANTING_STATUSES })
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

  async cancelMySubscription(userId: string, creatorId: string) {
    const sub = await this.subscriptionRepository.findOne({
      where: { userId, creatorId, status: MemberSubscriptionStatus.ACTIVE },
    });
    if (!sub) throw new NotFoundException('No active subscription found');

    if (sub.externalRef && sub.source === MemberSubscriptionSource.STRIPE && this.stripeTierSync?.isEnabled()) {
      await this.stripeTierSync.cancelSubscription(sub.externalRef);
    }

    sub.status = MemberSubscriptionStatus.CANCELED;
    await this.subscriptionRepository.save(sub);
    await this.bustSubscriptionCache(userId, creatorId);
    return { canceled: true };
  }

  async cancelByExternalRef(externalRef: string): Promise<void> {
    const sub = await this.subscriptionRepository.findOne({
      where: { externalRef },
      order: { createdAt: 'DESC' },
    });
    if (!sub || sub.status === MemberSubscriptionStatus.CANCELED) return;
    sub.status = MemberSubscriptionStatus.CANCELED;
    await this.subscriptionRepository.save(sub);
    await this.bustSubscriptionCache(sub.userId, sub.creatorId);
  }

  async markSubscriptionFailedPayment(externalRef: string): Promise<void> {
    const sub = await this.subscriptionRepository.findOne({
      where: { externalRef },
      order: { createdAt: 'DESC' },
    });
    if (!sub) return;
    sub.status = MemberSubscriptionStatus.FAILED_PAYMENT;
    await this.subscriptionRepository.save(sub);
    await this.bustSubscriptionCache(sub.userId, sub.creatorId);
  }

  async hasTierEntitlement(
    userId: string,
    creatorId: string,
    resourceType: TierEntitlementResourceType,
    resourceId?: string | null,
  ): Promise<boolean> {
    const sub = await this.getActiveSubscription(userId, creatorId);
    if (!sub) return false;

    const entitlements = await this.tierEntitlementRepository.find({
      where: { tierId: sub.tierId },
    });
    if (entitlements.length === 0) return true;

    return entitlements.some(
      (e) =>
        e.resourceType === resourceType &&
        (e.resourceId == null || e.resourceId === resourceId || e.resourceId === creatorId),
    );
  }

  async listTierEntitlements(creatorId: string, tierId: string) {
    const tier = await this.getTierById(tierId);
    if (tier.creatorId !== creatorId) throw new ForbiddenException();
    return this.tierEntitlementRepository.find({ where: { tierId }, order: { createdAt: 'ASC' } });
  }

  async addTierEntitlement(
    creatorId: string,
    tierId: string,
    input: { resourceType: TierEntitlementResourceType; resourceId?: string | null; accessLevel?: string },
  ) {
    const tier = await this.getTierById(tierId);
    if (tier.creatorId !== creatorId) throw new ForbiddenException();
    const ent = await this.tierEntitlementRepository.save(
      this.tierEntitlementRepository.create({
        tierId,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        accessLevel: input.accessLevel ?? 'full',
      }),
    );
    return ent;
  }

  async removeTierEntitlement(creatorId: string, tierId: string, entitlementId: string) {
    const tier = await this.getTierById(tierId);
    if (tier.creatorId !== creatorId) throw new ForbiddenException();
    const ent = await this.tierEntitlementRepository.findOne({ where: { id: entitlementId, tierId } });
    if (!ent) throw new NotFoundException('Entitlement not found');
    await this.tierEntitlementRepository.delete(entitlementId);
    return { deleted: true };
  }

  async updateSubscriptionStatusByExternalRef(
    externalRef: string,
    status: MemberSubscriptionStatus,
  ): Promise<void> {
    const sub = await this.subscriptionRepository.findOne({
      where: { externalRef },
      order: { createdAt: 'DESC' },
    });
    if (!sub) return;
    sub.status = status;
    await this.subscriptionRepository.save(sub);
    await this.bustSubscriptionCache(sub.userId, sub.creatorId);
  }

  async listSubscribersForCreator(
    creatorId: string,
    opts?: { status?: MemberSubscriptionStatus; limit?: number; offset?: number },
  ) {
    const qb = this.subscriptionRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .leftJoinAndSelect('s.tier', 'tier')
      .where('s.creator_id = :creatorId', { creatorId })
      .orderBy('s.created_at', 'DESC')
      .take(opts?.limit ?? 50)
      .skip(opts?.offset ?? 0);

    if (opts?.status) {
      qb.andWhere('s.status = :status', { status: opts.status });
    } else {
      qb.andWhere('s.status IN (:...statuses)', { statuses: ACCESS_GRANTING_STATUSES });
    }

    const subs = await qb.getMany();
    return subs.map((s) => ({
      id: s.id,
      userId: s.userId,
      username: s.user?.username,
      displayName: s.user?.displayName,
      tierName: s.tier?.name,
      status: s.status,
      source: s.source,
      startsAt: s.startsAt,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
    }));
  }

  async suspendSubscriber(creatorId: string, subscriptionId: string) {
    const sub = await this.subscriptionRepository.findOne({ where: { id: subscriptionId, creatorId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    sub.status = MemberSubscriptionStatus.SUSPENDED;
    await this.subscriptionRepository.save(sub);
    await this.bustSubscriptionCache(sub.userId, creatorId);
    return { suspended: true };
  }

  async exportSubscribersCsv(creatorId: string): Promise<string> {
    const subs = await this.listSubscribersForCreator(creatorId, { limit: 5000 });
    const header = 'userId,username,displayName,tier,status,source,startsAt,expiresAt';
    const rows = subs.map(
      (s) =>
        `${s.userId},${s.username ?? ''},${s.displayName ?? ''},${s.tierName ?? ''},${s.status},${s.source},${s.startsAt?.toISOString() ?? ''},${s.expiresAt?.toISOString() ?? ''}`,
    );
    return [header, ...rows].join('\n');
  }

  async getSubscriberAnalytics(creatorId: string) {
    const rows = await this.subscriptionRepository
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('s.creator_id = :creatorId', { creatorId })
      .groupBy('s.status')
      .getRawMany<{ status: string; count: string }>();

    const byStatus = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
    const active = byStatus[MemberSubscriptionStatus.ACTIVE] ?? 0;
    const trial = byStatus[MemberSubscriptionStatus.TRIAL] ?? 0;
    const canceled = byStatus[MemberSubscriptionStatus.CANCELED] ?? 0;
    const mrrRows = await this.subscriptionRepository
      .createQueryBuilder('s')
      .leftJoin('s.tier', 'tier')
      .select('SUM(tier.price_cents)', 'mrrCents')
      .where('s.creator_id = :creatorId', { creatorId })
      .andWhere('s.status IN (:...statuses)', {
        statuses: [MemberSubscriptionStatus.ACTIVE, MemberSubscriptionStatus.TRIAL],
      })
      .getRawOne<{ mrrCents: string | null }>();

    return {
      active,
      trial,
      canceled,
      total: rows.reduce((sum, r) => sum + Number(r.count), 0),
      mrrCents: Number(mrrRows?.mrrCents ?? 0),
      byStatus,
    };
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
      .orderBy('s.expires_at', 'ASC')
      .take(500)
      .getMany();
  }

  slugify(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  }
}
