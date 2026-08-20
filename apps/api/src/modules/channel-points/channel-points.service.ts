import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { DataSource, In, Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  ChannelPointRedemption,
  ChannelPointRedemptionStatus,
  ChannelPointReward,
  ChannelPointRewardStatus,
  ChannelPointsBalance,
} from './entities/channel-points.entity';
import { EngagementService } from '../engagement/engagement.service';

@Injectable()
export class ChannelPointsService {
  private readonly logger = new Logger(ChannelPointsService.name);
  static readonly STREAM_WATCH_POINTS = 10;
  static readonly CHAT_MESSAGE_POINTS = 2;
  static readonly POST_POINTS = 5;

  constructor(
    @InjectRepository(ChannelPointsBalance)
    private readonly balanceRepository: Repository<ChannelPointsBalance>,
    @InjectRepository(ChannelPointReward)
    private readonly rewardRepository: Repository<ChannelPointReward>,
    @InjectRepository(ChannelPointRedemption)
    private readonly redemptionRepository: Repository<ChannelPointRedemption>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
    private readonly engagementService: EngagementService,
  ) {}

  private async assertNotBlockedFromCommunity(
    viewerId: string,
    communityId: string,
  ): Promise<void> {
    const [row] = await this.dataSource.query<[{ creator_id: string }?]>(
      `SELECT creator_id FROM communities WHERE id = $1 LIMIT 1`,
      [communityId],
    );
    if (!row) throw new NotFoundException('Community not found');
    if (await this.engagementService.isBlockedEitherWay(viewerId, row.creator_id)) {
      throw new ForbiddenException('This channel is not available');
    }
  }

  async getBalance(userId: string, communityId: string) {
    await this.assertNotBlockedFromCommunity(userId, communityId);
    const row = await this.balanceRepository.findOne({ where: { userId, communityId } });
    return {
      communityId,
      userId,
      balance: row?.balance ?? 0,
      totalEarned: row?.totalEarned ?? 0,
    };
  }

  async earnPoints(userId: string, communityId: string, points: number): Promise<void> {
    if (points <= 0) return;
    try {
      await this.assertNotBlockedFromCommunity(userId, communityId);
    } catch {
      // Blocked peers / missing community: never award points via events.
      return;
    }
    await this.dataSource.query(
      `INSERT INTO channel_points_balances (community_id, user_id, balance, total_earned)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (community_id, user_id)
       DO UPDATE SET balance = channel_points_balances.balance + $3,
                     total_earned = channel_points_balances.total_earned + $3,
                     updated_at = NOW()`,
      [communityId, userId, points],
    );
  }

  // ── Rewards catalog ────────────────────────────────────────────────────────

  private async assertCommunityOwner(creatorId: string, communityId: string): Promise<void> {
    const [row] = await this.dataSource.query<[{ creator_id: string }?]>(
      `SELECT creator_id FROM communities WHERE id = $1 LIMIT 1`,
      [communityId],
    );
    if (!row) throw new NotFoundException('Community not found');
    if (row.creator_id !== creatorId) throw new ForbiddenException('Not the community owner');
  }

  async createReward(
    creatorId: string,
    communityId: string,
    input: {
      title: string;
      description?: string;
      costPoints: number;
      maxPerUser?: number;
      globalMax?: number;
      requiresApproval?: boolean;
    },
  ) {
    await this.assertCommunityOwner(creatorId, communityId);
    if (input.costPoints < 1) throw new BadRequestException('Cost must be at least 1 point');
    const count = await this.rewardRepository.count({
      where: { communityId, status: ChannelPointRewardStatus.ACTIVE },
    });
    if (count >= 20) throw new BadRequestException('Maximum 20 active rewards per community');

    const reward = await this.rewardRepository.save(
      this.rewardRepository.create({
        communityId,
        title: input.title.trim().slice(0, 100),
        description: input.description?.trim() ?? null,
        costPoints: input.costPoints,
        maxPerUser: input.maxPerUser ?? null,
        globalMax: input.globalMax ?? null,
        requiresApproval: input.requiresApproval ?? false,
      }),
    );
    return reward;
  }

  async listRewards(communityId: string, includeInactive = false, viewerId?: string) {
    if (viewerId) await this.assertNotBlockedFromCommunity(viewerId, communityId);
    const statuses = includeInactive
      ? [ChannelPointRewardStatus.ACTIVE, ChannelPointRewardStatus.PAUSED]
      : [ChannelPointRewardStatus.ACTIVE];
    const rewards = await this.rewardRepository.find({
      where: statuses.map((s) => ({ communityId, status: s })),
      order: { costPoints: 'ASC' },
    });
    return { data: rewards };
  }

  async listCreatorRewards(creatorId: string, communityId: string) {
    await this.assertCommunityOwner(creatorId, communityId);
    return this.listRewards(communityId, true);
  }

  async updateReward(
    creatorId: string,
    communityId: string,
    rewardId: string,
    input: Partial<{
      title: string;
      description: string | null;
      costPoints: number;
      maxPerUser: number | null;
      globalMax: number | null;
      requiresApproval: boolean;
      status: ChannelPointRewardStatus;
    }>,
  ) {
    await this.assertCommunityOwner(creatorId, communityId);
    const reward = await this.rewardRepository.findOne({ where: { id: rewardId, communityId } });
    if (!reward) throw new NotFoundException('Reward not found');
    if (input.title !== undefined) reward.title = input.title.trim().slice(0, 100);
    if (input.description !== undefined) reward.description = input.description;
    if (input.costPoints !== undefined) {
      if (input.costPoints < 1) throw new BadRequestException('Cost must be at least 1 point');
      reward.costPoints = input.costPoints;
    }
    if (input.maxPerUser !== undefined) reward.maxPerUser = input.maxPerUser;
    if (input.globalMax !== undefined) reward.globalMax = input.globalMax;
    if (input.requiresApproval !== undefined) reward.requiresApproval = input.requiresApproval;
    if (input.status !== undefined) reward.status = input.status;
    return this.rewardRepository.save(reward);
  }

  async deleteReward(creatorId: string, communityId: string, rewardId: string): Promise<void> {
    await this.assertCommunityOwner(creatorId, communityId);
    const reward = await this.rewardRepository.findOne({ where: { id: rewardId, communityId } });
    if (!reward) throw new NotFoundException('Reward not found');
    await this.rewardRepository.update(rewardId, { status: ChannelPointRewardStatus.ARCHIVED });
  }

  // ── Redemptions ────────────────────────────────────────────────────────────

  async redeem(userId: string, communityId: string, rewardId: string, message?: string) {
    await this.assertNotBlockedFromCommunity(userId, communityId);
    const reward = await this.rewardRepository.findOne({
      where: { id: rewardId, communityId, status: ChannelPointRewardStatus.ACTIVE },
    });
    if (!reward) throw new NotFoundException('Reward not found or not available');

    await this.dataSource.transaction(async (manager) => {
      // count-then-insert on the cap checks below is a TOCTOU race — two
      // concurrent redeem calls for a capped reward (e.g. globalMax: 1 merch
      // item) could both pass the count check before either row commits.
      // Same fix shape as the RSVP-capacity and strike-escalation races
      // fixed earlier this session: an advisory lock scoped to the reward
      // serializes concurrent redemptions of it.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `channel-point-redeem:${rewardId}`,
      ]);
      // Second lock, same fixed order on every call (reward then
      // user+community) to avoid a deadlock between two concurrent
      // transactions each wanting both: also serializes this same user's
      // own concurrent redemptions (possibly of different rewards) against
      // each other, so a stale balance read can't let two of their
      // redemptions both pass the balance check and jointly overspend.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `channel-point-balance:${communityId}:${userId}`,
      ]);

      const balance = await manager.findOne(ChannelPointsBalance, {
        where: { userId, communityId },
      });
      if (!balance || balance.balance < reward.costPoints) {
        throw new BadRequestException('Insufficient channel points');
      }

      // Both caps count FULFILLED + PENDING (not REJECTED) — a rejected
      // redemption was refunded and never actually consumed inventory, so
      // counting it here would permanently shrink a limited reward's real
      // availability below its configured cap. Counting PENDING here (not
      // just FULFILLED, as the per-user check previously did) also closes
      // the gap where a user could rack up unlimited pending requests for a
      // requiresApproval reward, bounded only by their balance.
      const unresolvedStatuses = [
        ChannelPointRedemptionStatus.FULFILLED,
        ChannelPointRedemptionStatus.PENDING,
      ];

      // Per-user max check
      if (reward.maxPerUser != null) {
        const userCount = await manager.count(ChannelPointRedemption, {
          where: {
            rewardId,
            userId,
            status: In(unresolvedStatuses),
          },
        });
        if (userCount >= reward.maxPerUser) {
          throw new BadRequestException('You have reached the maximum redemptions for this reward');
        }
      }

      // Global max check
      if (reward.globalMax != null) {
        const globalCount = await manager.count(ChannelPointRedemption, {
          where: { rewardId, status: In(unresolvedStatuses) },
        });
        if (globalCount >= reward.globalMax) {
          throw new BadRequestException('This reward is no longer available');
        }
      }

      // Deduct points
      await manager.decrement(ChannelPointsBalance, { userId, communityId }, 'balance', reward.costPoints);

      // Create redemption
      const status = reward.requiresApproval
        ? ChannelPointRedemptionStatus.PENDING
        : ChannelPointRedemptionStatus.FULFILLED;

      const redemption = await manager.save(
        manager.create(ChannelPointRedemption, {
          rewardId,
          communityId,
          userId,
          costPoints: reward.costPoints,
          status,
          message: message?.trim().slice(0, 500) ?? null,
        }),
      );

      this.eventEmitter.emit('channel_points.redeemed', {
        communityId,
        rewardId,
        userId,
        redemptionId: redemption.id,
        requiresApproval: reward.requiresApproval,
      });
    });

    return { redeemed: true, rewardId };
  }

  async listRedemptions(
    creatorId: string,
    communityId: string,
    options?: { status?: ChannelPointRedemptionStatus; limit?: number },
  ) {
    await this.assertCommunityOwner(creatorId, communityId);
    const where: { communityId: string; status?: ChannelPointRedemptionStatus } = { communityId };
    if (options?.status) where.status = options.status;
    const rows = await this.redemptionRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: Math.min(options?.limit ?? 50, 100),
    });
    if (!rows.length) return { data: [] };

    const rewardIds = [...new Set(rows.map((r) => r.rewardId))];
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const [rewards, users] = await Promise.all([
      this.rewardRepository.find({ where: { id: In(rewardIds) } }),
      this.dataSource.query<
        Array<{ id: string; username: string | null; display_name: string | null }>
      >(`SELECT id, username, display_name FROM users WHERE id = ANY($1::uuid[])`, [userIds]),
    ]);
    const rewardMap = new Map(rewards.map((r) => [r.id, r]));
    const userMap = new Map(
      users.map((u) => [
        u.id,
        { username: u.username ?? undefined, displayName: u.display_name ?? undefined },
      ]),
    );

    return {
      data: rows.map((row) => {
        const reward = rewardMap.get(row.rewardId);
        return {
          ...row,
          reward: reward
            ? {
                id: reward.id,
                title: reward.title,
                costPoints: reward.costPoints,
              }
            : null,
          user: userMap.get(row.userId) ?? null,
        };
      }),
    };
  }

  async approveRedemption(creatorId: string, communityId: string, redemptionId: string): Promise<void> {
    await this.assertCommunityOwner(creatorId, communityId);
    const redemption = await this.redemptionRepository.findOne({
      where: { id: redemptionId, communityId, status: ChannelPointRedemptionStatus.PENDING },
    });
    if (!redemption) throw new NotFoundException('Pending redemption not found');
    await this.redemptionRepository.update(redemptionId, {
      status: ChannelPointRedemptionStatus.FULFILLED,
    });
  }

  async rejectRedemption(creatorId: string, communityId: string, redemptionId: string): Promise<void> {
    await this.assertCommunityOwner(creatorId, communityId);
    const redemption = await this.redemptionRepository.findOne({
      where: { id: redemptionId, communityId, status: ChannelPointRedemptionStatus.PENDING },
    });
    if (!redemption) throw new NotFoundException('Pending redemption not found');

    await this.dataSource.transaction(async (manager) => {
      await manager.update(ChannelPointRedemption, redemptionId, {
        status: ChannelPointRedemptionStatus.REJECTED,
      });
      // Refund points
      await manager.increment(
        ChannelPointsBalance,
        { userId: redemption.userId, communityId },
        'balance',
        redemption.costPoints,
      );
    });
  }

  // ── Admin oversight ────────────────────────────────────────────────────────

  async adminListPendingRedemptions(limit = 50) {
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.redemptionRepository.find({
      where: { status: ChannelPointRedemptionStatus.PENDING },
      order: { createdAt: 'DESC' },
      take,
    });
    if (!rows.length) return { data: [] };

    const rewardIds = [...new Set(rows.map((r) => r.rewardId))];
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const communityIds = [...new Set(rows.map((r) => r.communityId))];
    const [rewards, users, communities] = await Promise.all([
      this.rewardRepository.find({ where: { id: In(rewardIds) } }),
      this.dataSource.query<
        Array<{ id: string; username: string | null; display_name: string | null }>
      >(`SELECT id, username, display_name FROM users WHERE id = ANY($1::uuid[])`, [userIds]),
      this.dataSource.query<Array<{ id: string; name: string; slug: string }>>(
        `SELECT id, name, slug FROM communities WHERE id = ANY($1::uuid[])`,
        [communityIds],
      ),
    ]);
    const rewardMap = new Map(rewards.map((r) => [r.id, r]));
    const userMap = new Map(
      users.map((u) => [
        u.id,
        { username: u.username ?? undefined, displayName: u.display_name ?? undefined },
      ]),
    );
    const communityMap = new Map(communities.map((c) => [c.id, c]));

    return {
      data: rows.map((row) => {
        const reward = rewardMap.get(row.rewardId);
        return {
          ...row,
          reward: reward
            ? { id: reward.id, title: reward.title, costPoints: reward.costPoints }
            : null,
          user: userMap.get(row.userId) ?? null,
          community: communityMap.get(row.communityId) ?? null,
        };
      }),
    };
  }

  async adminCommunityPointsSummary(limit = 50) {
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.dataSource.query<
      Array<{
        community_id: string;
        name: string;
        slug: string;
        members_with_balance: string;
        total_balance: string;
        total_earned: string;
        pending_redemptions: string;
      }>
    >(
      `SELECT c.id AS community_id, c.name, c.slug,
              COUNT(DISTINCT b.user_id)::text AS members_with_balance,
              COALESCE(SUM(b.balance), 0)::text AS total_balance,
              COALESCE(SUM(b.total_earned), 0)::text AS total_earned,
              (
                SELECT COUNT(*)::text FROM channel_point_redemptions r
                WHERE r.community_id = c.id AND r.status = 'pending'
              ) AS pending_redemptions
       FROM communities c
       LEFT JOIN channel_points_balances b ON b.community_id = c.id
       GROUP BY c.id, c.name, c.slug
       HAVING COALESCE(SUM(b.total_earned), 0) > 0
           OR EXISTS (
             SELECT 1 FROM channel_point_redemptions r
             WHERE r.community_id = c.id AND r.status = 'pending'
           )
       ORDER BY COALESCE(SUM(b.total_earned), 0) DESC
       LIMIT $1`,
      [take],
    );
    return {
      data: rows.map((r) => ({
        communityId: r.community_id,
        name: r.name,
        slug: r.slug,
        membersWithBalance: Number(r.members_with_balance) || 0,
        totalBalance: Number(r.total_balance) || 0,
        totalEarned: Number(r.total_earned) || 0,
        pendingRedemptions: Number(r.pending_redemptions) || 0,
      })),
    };
  }

  // ── Event-driven point earning ─────────────────────────────────────────────

  private async earnOnce(
    rateKey: string,
    ttlSec: number,
    userId: string,
    communityId: string,
    points: number,
  ): Promise<void> {
    try {
      const acquired = await this.redis.set(rateKey, '1', 'EX', ttlSec, 'NX');
      if (acquired !== 'OK') return;
      await this.earnPoints(userId, communityId, points);
    } catch (err) {
      this.logger.debug(
        `Channel points earn skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  @OnEvent('community.post.created')
  async onCommunityPost(payload: { communityId: string; post: { authorId?: string } }) {
    const authorId = (payload.post as Record<string, unknown>)?.authorId as string | undefined;
    if (!authorId || !payload.communityId) return;
    // Unlike every other earn path here (chat: 60s cooldown, watch: 24h
    // cooldown), this called earnPoints directly with no earnOnce guard —
    // CommunityPostsService.createPost has no rate limit of its own either,
    // so a user could farm unlimited points by spamming posts.
    await this.earnOnce(
      `cp:post:${payload.communityId}:${authorId}`,
      60,
      authorId,
      payload.communityId,
      ChannelPointsService.POST_POINTS,
    );
  }

  @OnEvent('room.message')
  async onRoomMessage(payload: {
    communityId?: string;
    message?: { userId?: string };
  }) {
    const userId = payload.message?.userId;
    const communityId = payload.communityId;
    if (!userId || !communityId) return;
    await this.earnOnce(
      `cp:chat:${communityId}:${userId}`,
      60,
      userId,
      communityId,
      ChannelPointsService.CHAT_MESSAGE_POINTS,
    );
  }

  @OnEvent('stream.chat.message')
  async onStreamChatMessage(payload: {
    streamId?: string;
    message?: { userId?: string };
  }) {
    const userId = payload.message?.userId;
    const streamId = payload.streamId;
    if (!userId || !streamId) return;
    const [row] = await this.dataSource.query<[{ community_id: string | null }?]>(
      `SELECT community_id FROM streams WHERE id = $1 LIMIT 1`,
      [streamId],
    );
    const communityId = row?.community_id;
    if (!communityId) return;
    await this.earnOnce(
      `cp:chat:${communityId}:${userId}`,
      60,
      userId,
      communityId,
      ChannelPointsService.CHAT_MESSAGE_POINTS,
    );
  }

  @OnEvent('stream.viewer.joined')
  async onStreamViewerJoined(payload: { streamId?: string; userId?: string }) {
    const { streamId, userId } = payload;
    if (!streamId || !userId) return;
    const [row] = await this.dataSource.query<[{ community_id: string | null }?]>(
      `SELECT community_id FROM streams WHERE id = $1 LIMIT 1`,
      [streamId],
    );
    const communityId = row?.community_id;
    if (!communityId) return;
    await this.earnOnce(
      `cp:watch:${streamId}:${userId}`,
      86_400,
      userId,
      communityId,
      ChannelPointsService.STREAM_WATCH_POINTS,
    );
  }
}
