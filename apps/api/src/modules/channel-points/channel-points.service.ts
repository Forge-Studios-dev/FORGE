import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  ChannelPointRedemption,
  ChannelPointRedemptionStatus,
  ChannelPointReward,
  ChannelPointRewardStatus,
  ChannelPointsBalance,
} from './entities/channel-points.entity';

@Injectable()
export class ChannelPointsService {
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
  ) {}

  async getBalance(userId: string, communityId: string) {
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

  async listRewards(communityId: string, includeInactive = false) {
    const statuses = includeInactive
      ? [ChannelPointRewardStatus.ACTIVE, ChannelPointRewardStatus.PAUSED]
      : [ChannelPointRewardStatus.ACTIVE];
    const rewards = await this.rewardRepository.find({
      where: statuses.map((s) => ({ communityId, status: s })),
      order: { costPoints: 'ASC' },
    });
    return { data: rewards };
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
    const reward = await this.rewardRepository.findOne({
      where: { id: rewardId, communityId, status: ChannelPointRewardStatus.ACTIVE },
    });
    if (!reward) throw new NotFoundException('Reward not found or not available');

    await this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(ChannelPointsBalance, {
        where: { userId, communityId },
      });
      if (!balance || balance.balance < reward.costPoints) {
        throw new BadRequestException('Insufficient channel points');
      }

      // Per-user max check
      if (reward.maxPerUser != null) {
        const userCount = await manager.count(ChannelPointRedemption, {
          where: {
            rewardId,
            userId,
            status: ChannelPointRedemptionStatus.FULFILLED,
          },
        });
        if (userCount >= reward.maxPerUser) {
          throw new BadRequestException('You have reached the maximum redemptions for this reward');
        }
      }

      // Global max check
      if (reward.globalMax != null) {
        const globalCount = await manager.count(ChannelPointRedemption, {
          where: { rewardId },
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
    return { data: rows };
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

  // ── Event-driven point earning ─────────────────────────────────────────────

  @OnEvent('community.post.created')
  async onCommunityPost(payload: { communityId: string; post: { authorId?: string } }) {
    const authorId = (payload.post as Record<string, unknown>)?.authorId as string | undefined;
    if (!authorId || !payload.communityId) return;
    await this.earnPoints(authorId, payload.communityId, ChannelPointsService.POST_POINTS).catch(() => {});
  }
}
