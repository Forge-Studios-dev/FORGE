import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository, LessThanOrEqual, MoreThan, And, DataSource, In } from 'typeorm';
import { UserRole } from '../users/entities/user.entity';
import { SubscriptionTier } from './entities/subscription-tier.entity';
import {
  MemberSubscription,
  MemberSubscriptionSource,
  MemberSubscriptionStatus,
} from './entities/member-subscription.entity';
import { CreateTierDto, UpdateTierDto, MockSubscriptionDto, AdminGrantSubscriptionDto, CreatorGrantSubscriptionDto } from './dto/tier.dto';
import { toPublicTier, toPublicSubscription } from './tier.mapper';
import { EngagementService } from '../engagement/engagement.service';
import { ChannelType } from './entities/channel-type.enum';
import { ContentVisibility, StreamVisibility } from './content-access.types';
import { StreamEventPurchase } from '../streaming/entities/stream-event-purchase.entity';
import { TierEntitlement, TierEntitlementResourceType } from './entities/tier-entitlement.entity';
import { BillingInterval } from './entities/subscription-tier.entity';
import { StripeTierSyncService } from '../billing/stripe-tier-sync.service';
import { recordEntitlementCacheHit } from '../../common/metrics/forge-metrics';
import { EntitlementsAnalyticsService } from './entitlements-analytics.service';
import { ACCESS_GRANTING_STATUSES } from './access-granting-statuses';

export { ACCESS_GRANTING_STATUSES };

const TIER_ACCESS_LEVEL_RANK: Record<string, number> = {
  read: 1,
  write: 2,
  full: 3,
  admin: 3,
};

export type TierAccessAction = 'read' | 'write' | 'full';

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
    private readonly eventEmitter: EventEmitter2,
    private readonly analyticsService: EntitlementsAnalyticsService,
    @Optional() private readonly stripeTierSync?: StripeTierSyncService,
  ) {}

  private emitCommunityAccessChanged(
    userId: string,
    creatorId: string,
    communityId?: string | null,
    provisionMember = false,
  ): void {
    this.eventEmitter.emit('community.access.changed', { userId, creatorId, communityId });
    if (provisionMember && communityId) {
      this.eventEmitter.emit('community.member.provision', { userId, communityId, creatorId });
    }
  }

  private emitMemberSuspend(userId: string, communityId: string): void {
    this.eventEmitter.emit('community.member.suspend', { userId, communityId });
  }

  private tierAccessLevelMeets(entitlementLevel: string, required: TierAccessAction): boolean {
    const granted = TIER_ACCESS_LEVEL_RANK[entitlementLevel.toLowerCase()] ?? TIER_ACCESS_LEVEL_RANK.full;
    const needed = TIER_ACCESS_LEVEL_RANK[required] ?? TIER_ACCESS_LEVEL_RANK.read;
    return granted >= needed;
  }

  private revokeCommunityMembershipIfNeeded(
    sub: Pick<MemberSubscription, 'userId' | 'communityId'> | null | undefined,
    status?: MemberSubscriptionStatus,
  ): void {
    if (!sub?.communityId) return;
    if (status && ACCESS_GRANTING_STATUSES.includes(status)) return;
    this.emitMemberSuspend(sub.userId, sub.communityId);
  }

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

  private async bustSubscriptionCache(
    userId: string,
    creatorId: string,
    communityId?: string | null,
  ): Promise<void> {
    const keys = [
      this.subscriptionCacheKey(userId, creatorId),
      this.viewerAccessCacheKey(userId, creatorId),
    ];
    if (communityId) {
      keys.push(`${this.subscriptionCacheKey(userId, creatorId)}:c:${communityId}`);
    }
    await Promise.all(keys.map((key) => this.redis.del(key)));
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
      const hit = map[field] ?? null;
      if (hit) recordEntitlementCacheHit(true);
      return hit;
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
      maxConcurrentDevices: Math.min(10, Math.max(1, dto.maxConcurrentDevices ?? 1)),
      maxMembers: dto.maxMembers ?? null,
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
    if (dto.maxConcurrentDevices !== undefined) {
      tier.maxConcurrentDevices = Math.min(10, Math.max(1, dto.maxConcurrentDevices));
    }
    if (dto.maxMembers !== undefined) tier.maxMembers = dto.maxMembers ?? null;

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

  async countActiveMembersOnTier(tierId: string): Promise<number> {
    return this.subscriptionRepository.count({
      where: {
        tierId,
        status: In(ACCESS_GRANTING_STATUSES),
      },
    });
  }

  async getActiveSubscription(
    userId: string,
    creatorId: string,
    communityId?: string | null,
  ): Promise<MemberSubscription | null> {
    const cacheKey = communityId
      ? `${this.subscriptionCacheKey(userId, creatorId)}:c:${communityId}`
      : this.subscriptionCacheKey(userId, creatorId);
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
    const qb = this.subscriptionRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.tier', 'tier')
      .where('s.user_id = :userId', { userId })
      .andWhere('s.creator_id = :creatorId', { creatorId })
      .andWhere('s.status IN (:...statuses)', { statuses: ACCESS_GRANTING_STATUSES })
      .andWhere('s.starts_at <= :now', { now })
      .andWhere('(s.expires_at IS NULL OR s.expires_at > :now)', { now });

    if (communityId) {
      qb.andWhere('(s.community_id IS NULL OR s.community_id = :communityId)', { communityId });
    }

    const sub = await qb.orderBy('s.community_id', 'DESC', 'NULLS LAST').addOrderBy('s.created_at', 'DESC').getOne();

    await this.redis.setex(cacheKey, 60, sub ? JSON.stringify(sub) : 'none');
    return sub;
  }

  async getMembershipForViewer(
    userId: string,
    creatorId: string,
    communityId?: string | null,
  ) {
    const sub = await this.getActiveSubscription(userId, creatorId, communityId);
    if (!sub) return { active: false as const };
    return {
      active: true as const,
      subscription: toPublicSubscription(sub),
      isTestMembership:
        sub.source === MemberSubscriptionSource.MOCK ||
        sub.source === MemberSubscriptionSource.ADMIN_GRANT,
    };
  }

  /** All access-granting subscriptions for a user+creator (for batched community visibility). */
  async listActiveSubscriptionsForCreator(
    userId: string,
    creatorId: string,
  ): Promise<MemberSubscription[]> {
    const now = new Date();
    return this.subscriptionRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.tier', 'tier')
      .where('s.user_id = :userId', { userId })
      .andWhere('s.creator_id = :creatorId', { creatorId })
      .andWhere('s.status IN (:...statuses)', { statuses: ACCESS_GRANTING_STATUSES })
      .andWhere('s.starts_at <= :now', { now })
      .andWhere('(s.expires_at IS NULL OR s.expires_at > :now)', { now })
      .orderBy('s.community_id', 'DESC', 'NULLS LAST')
      .addOrderBy('s.created_at', 'DESC')
      .getMany();
  }

  /** Whether any active subscription covers a specific community (creator-wide or scoped). */
  subscriptionCoversCommunity(subs: MemberSubscription[], communityId: string): boolean {
    return subs.some((s) => s.communityId == null || s.communityId === communityId);
  }

  /** Batch-resolve active tier display names for chat sub badges. */
  async getActiveTierNamesByUserIds(creatorId: string, userIds: string[]) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (!unique.length) return new Map<string, string>();

    const now = new Date();
    const subs = await this.subscriptionRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.tier', 'tier')
      .where('s.creator_id = :creatorId', { creatorId })
      .andWhere('s.user_id IN (:...userIds)', { userIds: unique })
      .andWhere('s.status IN (:...statuses)', { statuses: ACCESS_GRANTING_STATUSES })
      .andWhere('s.starts_at <= :now', { now })
      .andWhere('(s.expires_at IS NULL OR s.expires_at > :now)', { now })
      .orderBy('s.created_at', 'DESC')
      .getMany();

    const tierNames = new Map<string, string>();
    for (const sub of subs) {
      if (sub.tier?.name && !tierNames.has(sub.userId)) {
        tierNames.set(sub.userId, sub.tier.name);
      }
    }
    return tierNames;
  }

  /** Max simultaneous premium devices for a user (per creator subscription or global max). */
  async getMaxConcurrentDevices(userId: string, creatorId?: string): Promise<number> {
    const clamp = (n: number) => Math.min(10, Math.max(1, n));
    if (creatorId) {
      const sub = await this.getActiveSubscription(userId, creatorId);
      if (!sub?.tier) return 1;
      return clamp(sub.tier.maxConcurrentDevices ?? 1);
    }
    const now = new Date();
    const subs = await this.subscriptionRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.tier', 'tier')
      .where('s.user_id = :userId', { userId })
      .andWhere('s.status = :status', { status: MemberSubscriptionStatus.ACTIVE })
      .andWhere('(s.expires_at IS NULL OR s.expires_at > :now)', { now })
      .getMany();
    if (!subs.length) return 1;
    return clamp(Math.max(...subs.map((s) => s.tier?.maxConcurrentDevices ?? 1)));
  }

  async hasActiveSubscription(userId: string, creatorId: string): Promise<boolean> {
    const sub = await this.getActiveSubscription(userId, creatorId);
    return !!sub;
  }

  async meetsTierRequirement(
    userId: string,
    creatorId: string,
    requiredTierId: string,
    communityId?: string | null,
  ): Promise<boolean> {
    const sub = await this.getActiveSubscription(userId, creatorId, communityId);
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
    opts?: { isOwner?: boolean; isAdmin?: boolean; action?: TierAccessAction },
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
      opts?.action ?? 'read',
    );
    return entitled ? result : { allowed: false, reason: 'tier_required' };
  }

  private async verifyChannelTierEntitlements(
    viewerId: string,
    creatorId: string,
    communityId?: string | null,
    channelId?: string | null,
    action: TierAccessAction = 'read',
  ): Promise<boolean> {
    if (channelId) {
      const byChannel = await this.hasTierEntitlement(
        viewerId,
        creatorId,
        TierEntitlementResourceType.CHANNEL,
        channelId,
        communityId,
        action,
      );
      if (byChannel) return true;
    }
    if (communityId) {
      return this.hasTierEntitlement(
        viewerId,
        creatorId,
        TierEntitlementResourceType.COMMUNITY,
        communityId,
        communityId,
        action,
      );
    }
    return true;
  }

  /** Enforce tier_entitlements rows for video/stream when configured on the active tier. */
  async verifyMediaTierEntitlements(
    viewerId: string,
    creatorId: string,
    resourceType: TierEntitlementResourceType.VIDEO | TierEntitlementResourceType.STREAM,
    resourceId: string,
  ): Promise<boolean> {
    const sub = await this.getActiveSubscription(viewerId, creatorId);
    if (!sub) return false;

    const entitlements = await this.tierEntitlementRepository.find({
      where: { tierId: sub.tierId },
    });
    const mediaEntitlements = entitlements.filter(
      (e) =>
        e.resourceType === resourceType ||
        e.resourceType === TierEntitlementResourceType.CREATOR ||
        (resourceType === TierEntitlementResourceType.STREAM &&
          e.resourceType === TierEntitlementResourceType.EVENT),
    );
    if (mediaEntitlements.length === 0) return true;

    return mediaEntitlements.some(
      (e) =>
        e.resourceId == null ||
        e.resourceId === resourceId ||
        e.resourceId === creatorId,
    );
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
      const entitlementCache = new Map<string, boolean>();
      for (let i = 0; i < channels.length; i++) {
        const r = results[i];
        if (!r?.allowed) continue;
        const ch = channels[i];
        if (ch.type === ChannelType.PUBLIC || ch.type === ChannelType.INVITE) continue;
        const cacheKey = `${ch.creatorId}:${ch.communityId ?? ''}:${ch.channelId ?? ''}`;
        if (!entitlementCache.has(cacheKey)) {
          entitlementCache.set(
            cacheKey,
            await this.verifyChannelTierEntitlements(
              viewerId,
              ch.creatorId,
              ch.communityId,
              ch.channelId,
            ),
          );
        }
        if (!entitlementCache.get(cacheKey)) results[i] = { allowed: false, reason: 'tier_required' };
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
      const cancelQb = manager
        .createQueryBuilder()
        .update(MemberSubscription)
        .set({ status: MemberSubscriptionStatus.CANCELED })
        .where('user_id = :userId', { userId })
        .andWhere('creator_id = :creatorId', { creatorId })
        .andWhere('status IN (:...statuses)', { statuses: ACCESS_GRANTING_STATUSES });
      if (dto.communityId) {
        cancelQb.andWhere('community_id = :communityId', { communityId: dto.communityId });
      } else {
        cancelQb.andWhere('community_id IS NULL');
      }
      await cancelQb.execute();

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
          communityId: dto.communityId ?? null,
        }),
      );
    });

    await this.bustSubscriptionCache(userId, creatorId, dto.communityId ?? null);
    this.emitCommunityAccessChanged(userId, creatorId, dto.communityId ?? null, !!dto.communityId);
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

  async creatorGrantSubscription(creatorId: string, dto: CreatorGrantSubscriptionDto) {
    const tier = await this.getTierById(dto.tierId);
    if (tier.creatorId !== creatorId) {
      throw new BadRequestException('Tier does not belong to creator');
    }
    return this.grantSubscription(
      dto.userId,
      {
        creatorId,
        tierId: dto.tierId,
        expiresInDays: dto.expiresInDays,
        communityId: dto.communityId,
      },
      MemberSubscriptionSource.ADMIN_GRANT,
    );
  }

  async listMySubscriptions(userId: string) {
    const subs = await this.subscriptionRepository.find({
      where: {
        userId,
        status: In(ACCESS_GRANTING_STATUSES),
      },
      relations: ['tier', 'creator'],
      order: { createdAt: 'DESC' },
    });
    return subs.map(toPublicSubscription);
  }

  async cancelMySubscription(userId: string, creatorId: string, cancelAtPeriodEnd = false) {
    const sub = await this.subscriptionRepository.findOne({
      where: {
        userId,
        creatorId,
        status: In(ACCESS_GRANTING_STATUSES),
      },
      order: { createdAt: 'DESC' },
    });
    if (!sub) throw new NotFoundException('No active subscription found');

    if (sub.externalRef && sub.source === MemberSubscriptionSource.STRIPE && this.stripeTierSync?.isEnabled()) {
      await this.stripeTierSync.cancelSubscription(sub.externalRef, cancelAtPeriodEnd);
    }

    if (cancelAtPeriodEnd && sub.externalRef && sub.source === MemberSubscriptionSource.STRIPE) {
      sub.status = MemberSubscriptionStatus.RENEWAL_PENDING;
      await this.subscriptionRepository.save(sub);
      await this.bustSubscriptionCache(userId, creatorId, sub.communityId);
      this.emitCommunityAccessChanged(userId, creatorId, sub.communityId);
      return { canceled: false, cancelAtPeriodEnd: true };
    }

    sub.status = MemberSubscriptionStatus.CANCELED;
    await this.subscriptionRepository.save(sub);
    await this.bustSubscriptionCache(userId, creatorId, sub.communityId);
    this.emitCommunityAccessChanged(userId, creatorId, sub.communityId);
    this.revokeCommunityMembershipIfNeeded(sub, MemberSubscriptionStatus.CANCELED);
    return { canceled: true };
  }

  async cancelByExternalRef(externalRef: string): Promise<void> {
    const sub = await this.getSubscriptionByExternalRef(externalRef);
    if (!sub || sub.status === MemberSubscriptionStatus.CANCELED) return;
    sub.status = MemberSubscriptionStatus.CANCELED;
    await this.subscriptionRepository.save(sub);
    await this.bustSubscriptionCache(sub.userId, sub.creatorId, sub.communityId);
    this.emitCommunityAccessChanged(sub.userId, sub.creatorId, sub.communityId);
    this.revokeCommunityMembershipIfNeeded(sub, MemberSubscriptionStatus.CANCELED);
  }

  async getSubscriptionByExternalRef(externalRef: string): Promise<MemberSubscription | null> {
    return this.subscriptionRepository.findOne({
      where: { externalRef },
      order: { createdAt: 'DESC' },
    });
  }

  async markSubscriptionFailedPayment(externalRef: string): Promise<void> {
    const sub = await this.subscriptionRepository.findOne({
      where: { externalRef },
      order: { createdAt: 'DESC' },
    });
    if (!sub) return;
    sub.status = MemberSubscriptionStatus.FAILED_PAYMENT;
    await this.subscriptionRepository.save(sub);
    await this.bustSubscriptionCache(sub.userId, sub.creatorId, sub.communityId);
    this.emitCommunityAccessChanged(sub.userId, sub.creatorId, sub.communityId);
    this.revokeCommunityMembershipIfNeeded(sub, MemberSubscriptionStatus.FAILED_PAYMENT);
  }

  async markSubscriptionRefunded(externalRef: string): Promise<void> {
    const sub = await this.subscriptionRepository.findOne({
      where: { externalRef },
      order: { createdAt: 'DESC' },
    });
    if (!sub) return;
    sub.status = MemberSubscriptionStatus.REFUNDED;
    await this.subscriptionRepository.save(sub);
    await this.bustSubscriptionCache(sub.userId, sub.creatorId, sub.communityId);
    this.emitCommunityAccessChanged(sub.userId, sub.creatorId, sub.communityId);
    this.revokeCommunityMembershipIfNeeded(sub, MemberSubscriptionStatus.REFUNDED);
  }

  async hasTierEntitlement(
    userId: string,
    creatorId: string,
    resourceType: TierEntitlementResourceType,
    resourceId?: string | null,
    communityId?: string | null,
    requiredAccess: TierAccessAction = 'read',
  ): Promise<boolean> {
    const scopeCommunityId =
      communityId ??
      (resourceType === TierEntitlementResourceType.COMMUNITY ? resourceId : null);
    const sub = await this.getActiveSubscription(userId, creatorId, scopeCommunityId ?? undefined);
    if (!sub) return false;

    const entitlements = await this.tierEntitlementRepository.find({
      where: { tierId: sub.tierId },
    });
    if (entitlements.length === 0) return true;

    return entitlements.some(
      (e) =>
        e.resourceType === resourceType &&
        (e.resourceId == null || e.resourceId === resourceId || e.resourceId === creatorId) &&
        this.tierAccessLevelMeets(e.accessLevel, requiredAccess),
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
    await this.bustSubscriptionCache(sub.userId, sub.creatorId, sub.communityId);
    this.emitCommunityAccessChanged(sub.userId, sub.creatorId, sub.communityId);
    this.revokeCommunityMembershipIfNeeded(sub, status);
  }

  async updateSubscriptionExpiresByExternalRef(
    externalRef: string,
    expiresAt: Date,
  ): Promise<void> {
    const sub = await this.subscriptionRepository.findOne({
      where: { externalRef },
      order: { createdAt: 'DESC' },
    });
    if (!sub) return;
    sub.expiresAt = expiresAt;
    await this.subscriptionRepository.save(sub);
    await this.bustSubscriptionCache(sub.userId, sub.creatorId);
  }

  async changeSubscriptionTier(subscriptionId: string, newTierId: string): Promise<void> {
    const sub = await this.subscriptionRepository.findOne({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    const tier = await this.getTierById(newTierId);
    if (tier.creatorId !== sub.creatorId) {
      throw new BadRequestException('Tier does not belong to creator');
    }
    sub.tierId = newTierId;
    await this.subscriptionRepository.save(sub);
    await this.bustSubscriptionCache(sub.userId, sub.creatorId);
  }

  async findStripeSubscriptionForUser(userId: string, creatorId?: string) {
    const where: {
      userId: string;
      source: MemberSubscriptionSource;
      status: MemberSubscriptionStatus;
      creatorId?: string;
    } = {
      userId,
      source: MemberSubscriptionSource.STRIPE,
      status: MemberSubscriptionStatus.ACTIVE,
    };
    if (creatorId) where.creatorId = creatorId;
    return this.subscriptionRepository.findOne({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  // --- Cold-path analytics delegates (forwarded to EntitlementsAnalyticsService, H-A1) ---
  //
  // These stay on the public facade so controllers, notify jobs, and the
  // community analytics service keep working without a call-site migration.
  // The read/CSV logic itself lives in EntitlementsAnalyticsService.

  listSubscribersForCreator(
    creatorId: string,
    opts?: { status?: MemberSubscriptionStatus; limit?: number; offset?: number },
  ) {
    return this.analyticsService.listSubscribersForCreator(creatorId, opts);
  }

  exportSubscribersCsv(creatorId: string): Promise<string> {
    return this.analyticsService.exportSubscribersCsv(creatorId);
  }

  getSubscriberAnalytics(creatorId: string) {
    return this.analyticsService.getSubscriberAnalytics(creatorId);
  }

  async suspendSubscriber(creatorId: string, subscriptionId: string) {
    // Stays on the hot-path service: writes must invalidate the entitlement
    // Redis cache (bustSubscriptionCache) so the next access check sees the
    // suspended status. The analytics service is intentionally cache-blind.
    const sub = await this.subscriptionRepository.findOne({ where: { id: subscriptionId, creatorId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    sub.status = MemberSubscriptionStatus.SUSPENDED;
    await this.subscriptionRepository.save(sub);
    await this.bustSubscriptionCache(sub.userId, creatorId);
    return { suspended: true };
  }

  async expireDueSubscriptions(): Promise<number> {
    const now = new Date();
    // Safety net for access-granting statuses with a definite end date:
    //  - ACTIVE: normal expiry when a paid period lapses (webhook forward-dates
    //    expiresAt on renewal, so live subscriptions are never caught here).
    //  - TRIAL: a trial whose end date passed without conversion (Stripe webhook
    //    missed, or a non-Stripe/admin trial that has no webhook at all).
    //  - RENEWAL_PENDING: cancel-at-period-end reached its period end.
    // GRACE_PERIOD is intentionally excluded — its expiresAt is the already-past
    // period end, and time-expiring it would collapse the dunning grace window;
    // it exits via Stripe webhooks (recovered -> active, or final failure ->
    // canceled).
    const due = await this.subscriptionRepository.find({
      where: {
        status: In([
          MemberSubscriptionStatus.ACTIVE,
          MemberSubscriptionStatus.TRIAL,
          MemberSubscriptionStatus.RENEWAL_PENDING,
        ]),
        expiresAt: LessThanOrEqual(now),
      },
      take: 500,
    });
    if (!due.length) return 0;

    let expired = 0;
    for (const sub of due) {
      // Column update avoids relation/metadata hydration on save (Neon URL-only
      // TypeORM configs have historically thrown on databaseName during save).
      const result = await this.subscriptionRepository.update(
        { id: sub.id },
        { status: MemberSubscriptionStatus.EXPIRED },
      );
      if (!result.affected) continue;
      expired += 1;
      sub.status = MemberSubscriptionStatus.EXPIRED;
      await this.bustSubscriptionCache(sub.userId, sub.creatorId, sub.communityId);
      this.emitCommunityAccessChanged(sub.userId, sub.creatorId, sub.communityId);
      this.revokeCommunityMembershipIfNeeded(sub, MemberSubscriptionStatus.EXPIRED);
    }
    return expired;
  }

  async getExpiringSubscriptions(withinDays = 3): Promise<MemberSubscription[]> {
    const now = new Date();
    const until = new Date();
    until.setDate(until.getDate() + withinDays);

    // Prefer find+relations over QueryBuilder joins — avoids TypeORM metadata
    // paths that touch driver.database / databaseName when only DATABASE_URL is set.
    return this.subscriptionRepository.find({
      where: {
        status: In([MemberSubscriptionStatus.ACTIVE, MemberSubscriptionStatus.TRIAL]),
        expiresAt: And(MoreThan(now), LessThanOrEqual(until)),
      },
      relations: ['tier'],
      order: { expiresAt: 'ASC' },
      take: 500,
    });
  }

  slugify(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  }
}
