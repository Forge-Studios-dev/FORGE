import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChannelPointsService } from './channel-points.service';
import {
  ChannelPointRedemption,
  ChannelPointRedemptionStatus,
  ChannelPointReward,
  ChannelPointRewardStatus,
  ChannelPointsBalance,
} from './entities/channel-points.entity';
import { EngagementService } from '../engagement/engagement.service';

const CREATOR_ID = 'creator-1';
const COMMUNITY_ID = 'community-1';
const USER_ID = 'user-1';

describe('ChannelPointsService', () => {
  let service: ChannelPointsService;

  const balanceRepository = { findOne: jest.fn() };
  const rewardRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (r: unknown) => ({ id: 'reward-1', ...(r as object) })),
    create: jest.fn((r: unknown) => r),
    count: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };
  const redemptionRepository = { find: jest.fn(), findOne: jest.fn(), update: jest.fn() };
  const dataSource = { query: jest.fn(), transaction: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const redis = { set: jest.fn().mockResolvedValue('OK') };
  const engagementService = {
    isBlockedEitherWay: jest.fn().mockResolvedValue(false),
  };

  const fakeManager = {
    findOne: jest.fn(),
    count: jest.fn(),
    decrement: jest.fn(),
    increment: jest.fn(),
    update: jest.fn(),
    create: jest.fn((_e: unknown, obj: Record<string, unknown>) => obj),
    save: jest.fn(async (obj: Record<string, unknown>) => ({ id: 'redemption-1', ...obj })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    rewardRepository.create.mockImplementation((r: unknown) => r);
    rewardRepository.save.mockImplementation(async (r: unknown) => ({ id: 'reward-1', ...(r as object) }));
    fakeManager.create.mockImplementation((_e: unknown, obj: Record<string, unknown>) => obj);
    fakeManager.save.mockImplementation(async (obj: Record<string, unknown>) => ({
      id: 'redemption-1',
      ...obj,
    }));
    dataSource.transaction.mockImplementation(async (work: (m: typeof fakeManager) => Promise<unknown>) =>
      work(fakeManager),
    );
    dataSource.query.mockResolvedValue([{ creator_id: CREATOR_ID }]);
    engagementService.isBlockedEitherWay.mockResolvedValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelPointsService,
        { provide: getRepositoryToken(ChannelPointsBalance), useValue: balanceRepository },
        { provide: getRepositoryToken(ChannelPointReward), useValue: rewardRepository },
        { provide: getRepositoryToken(ChannelPointRedemption), useValue: redemptionRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
        { provide: EngagementService, useValue: engagementService },
      ],
    }).compile();

    service = module.get(ChannelPointsService);
  });

  describe('getBalance', () => {
    it('returns zeroed balance when no row exists', async () => {
      balanceRepository.findOne.mockResolvedValue(null);
      const result = await service.getBalance(USER_ID, COMMUNITY_ID);
      expect(result).toEqual({ communityId: COMMUNITY_ID, userId: USER_ID, balance: 0, totalEarned: 0 });
    });

    it('returns the stored balance', async () => {
      balanceRepository.findOne.mockResolvedValue({ balance: 40, totalEarned: 100 });
      const result = await service.getBalance(USER_ID, COMMUNITY_ID);
      expect(result.balance).toBe(40);
      expect(result.totalEarned).toBe(100);
    });

    it('rejects when viewer is blocked either way from the community creator', async () => {
      engagementService.isBlockedEitherWay.mockResolvedValue(true);
      await expect(service.getBalance(USER_ID, COMMUNITY_ID)).rejects.toMatchObject({
        message: 'This channel is not available',
      });
      expect(balanceRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('listRewards', () => {
    it('skips block check for anonymous viewers', async () => {
      rewardRepository.find.mockResolvedValue([]);
      await service.listRewards(COMMUNITY_ID);
      expect(engagementService.isBlockedEitherWay).not.toHaveBeenCalled();
    });

    it('rejects authenticated blocked viewers', async () => {
      engagementService.isBlockedEitherWay.mockResolvedValue(true);
      await expect(service.listRewards(COMMUNITY_ID, false, USER_ID)).rejects.toMatchObject({
        message: 'This channel is not available',
      });
    });
  });

  describe('earnPoints', () => {
    it('upserts the balance for positive points', async () => {
      await service.earnPoints(USER_ID, COMMUNITY_ID, 10);
      expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), [
        COMMUNITY_ID,
        USER_ID,
        10,
      ]);
    });

    it('is a no-op for zero or negative points', async () => {
      await service.earnPoints(USER_ID, COMMUNITY_ID, 0);
      await service.earnPoints(USER_ID, COMMUNITY_ID, -5);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('skips awarding when the viewer is blocked from the creator', async () => {
      engagementService.isBlockedEitherWay.mockResolvedValue(true);
      await service.earnPoints(USER_ID, COMMUNITY_ID, 10);
      expect(dataSource.query).not.toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.anything(),
      );
    });
  });

  describe('createReward', () => {
    it('rejects a non-owner', async () => {
      dataSource.query.mockResolvedValueOnce([{ creator_id: 'someone-else' }]);
      await expect(
        service.createReward(CREATOR_ID, COMMUNITY_ID, { title: 'Shoutout', costPoints: 50 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a reward with less than 1 cost point', async () => {
      dataSource.query.mockResolvedValueOnce([{ creator_id: CREATOR_ID }]);
      await expect(
        service.createReward(CREATOR_ID, COMMUNITY_ID, { title: 'Free', costPoints: 0 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects creating a 21st active reward', async () => {
      dataSource.query.mockResolvedValueOnce([{ creator_id: CREATOR_ID }]);
      rewardRepository.count.mockResolvedValue(20);
      await expect(
        service.createReward(CREATOR_ID, COMMUNITY_ID, { title: 'Shoutout', costPoints: 50 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a reward for the community owner under the cap', async () => {
      dataSource.query.mockResolvedValueOnce([{ creator_id: CREATOR_ID }]);
      rewardRepository.count.mockResolvedValue(3);

      const reward = await service.createReward(CREATOR_ID, COMMUNITY_ID, {
        title: 'Shoutout',
        costPoints: 50,
      });

      expect(reward).toMatchObject({ communityId: COMMUNITY_ID, title: 'Shoutout', costPoints: 50 });
    });
  });

  describe('redeem', () => {
    const reward = {
      id: 'reward-1',
      communityId: COMMUNITY_ID,
      costPoints: 100,
      maxPerUser: null,
      globalMax: null,
      requiresApproval: false,
      status: ChannelPointRewardStatus.ACTIVE,
    };

    it('throws NotFoundException when the reward does not exist or is inactive', async () => {
      rewardRepository.findOne.mockResolvedValue(null);
      await expect(service.redeem(USER_ID, COMMUNITY_ID, 'reward-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects redemption when balance is insufficient', async () => {
      rewardRepository.findOne.mockResolvedValue(reward);
      fakeManager.findOne.mockResolvedValue({ balance: 10 });

      await expect(service.redeem(USER_ID, COMMUNITY_ID, 'reward-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(fakeManager.decrement).not.toHaveBeenCalled();
    });

    it('rejects redemption once the per-user max is reached', async () => {
      rewardRepository.findOne.mockResolvedValue({ ...reward, maxPerUser: 2 });
      fakeManager.findOne.mockResolvedValue({ balance: 1000 });
      fakeManager.count.mockResolvedValue(2);

      await expect(service.redeem(USER_ID, COMMUNITY_ID, 'reward-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(fakeManager.decrement).not.toHaveBeenCalled();
    });

    it('rejects redemption once the global max is reached', async () => {
      rewardRepository.findOne.mockResolvedValue({ ...reward, globalMax: 5 });
      fakeManager.findOne.mockResolvedValue({ balance: 1000 });
      fakeManager.count.mockResolvedValue(5);

      await expect(service.redeem(USER_ID, COMMUNITY_ID, 'reward-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(fakeManager.decrement).not.toHaveBeenCalled();
    });

    it('deducts points and auto-fulfills when the reward does not require approval', async () => {
      rewardRepository.findOne.mockResolvedValue(reward);
      fakeManager.findOne.mockResolvedValue({ balance: 1000 });

      const result = await service.redeem(USER_ID, COMMUNITY_ID, 'reward-1', 'gimme');

      expect(fakeManager.decrement).toHaveBeenCalledWith(
        ChannelPointsBalance,
        { userId: USER_ID, communityId: COMMUNITY_ID },
        'balance',
        100,
      );
      expect(fakeManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ChannelPointRedemptionStatus.FULFILLED }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'channel_points.redeemed',
        expect.objectContaining({ requiresApproval: false }),
      );
      expect(result).toEqual({ redeemed: true, rewardId: 'reward-1' });
    });

    it('creates a pending redemption when the reward requires approval', async () => {
      rewardRepository.findOne.mockResolvedValue({ ...reward, requiresApproval: true });
      fakeManager.findOne.mockResolvedValue({ balance: 1000 });

      await service.redeem(USER_ID, COMMUNITY_ID, 'reward-1');

      expect(fakeManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ChannelPointRedemptionStatus.PENDING }),
      );
    });
  });

  describe('approveRedemption / rejectRedemption', () => {
    it('approveRedemption marks a pending redemption fulfilled', async () => {
      dataSource.query.mockResolvedValueOnce([{ creator_id: CREATOR_ID }]);
      redemptionRepository.findOne.mockResolvedValue({ id: 'redemption-1', status: ChannelPointRedemptionStatus.PENDING });

      await service.approveRedemption(CREATOR_ID, COMMUNITY_ID, 'redemption-1');

      expect(redemptionRepository.update).toHaveBeenCalledWith('redemption-1', {
        status: ChannelPointRedemptionStatus.FULFILLED,
      });
    });

    it('approveRedemption throws when no pending redemption is found', async () => {
      dataSource.query.mockResolvedValueOnce([{ creator_id: CREATOR_ID }]);
      redemptionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.approveRedemption(CREATOR_ID, COMMUNITY_ID, 'redemption-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejectRedemption marks rejected and refunds the points', async () => {
      dataSource.query.mockResolvedValueOnce([{ creator_id: CREATOR_ID }]);
      redemptionRepository.findOne.mockResolvedValue({
        id: 'redemption-1',
        userId: USER_ID,
        costPoints: 100,
        status: ChannelPointRedemptionStatus.PENDING,
      });

      await service.rejectRedemption(CREATOR_ID, COMMUNITY_ID, 'redemption-1');

      expect(fakeManager.update).toHaveBeenCalledWith(ChannelPointRedemption, 'redemption-1', {
        status: ChannelPointRedemptionStatus.REJECTED,
      });
      expect(fakeManager.increment).toHaveBeenCalledWith(
        ChannelPointsBalance,
        { userId: USER_ID, communityId: COMMUNITY_ID },
        'balance',
        100,
      );
    });
  });

  describe('onCommunityPost', () => {
    it('awards post points to the author', async () => {
      await service.onCommunityPost({ communityId: COMMUNITY_ID, post: { authorId: USER_ID } });
      expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), [
        COMMUNITY_ID,
        USER_ID,
        ChannelPointsService.POST_POINTS,
      ]);
    });

    it('does nothing when the post has no author', async () => {
      await service.onCommunityPost({ communityId: COMMUNITY_ID, post: {} });
      expect(dataSource.query).not.toHaveBeenCalled();
    });
  });
});
