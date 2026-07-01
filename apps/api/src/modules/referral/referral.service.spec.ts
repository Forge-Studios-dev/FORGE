import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReferralService } from './referral.service';
import { UserReferral, UserReferralCode, ReferralStatus } from './entities/referral.entity';
import { GamificationService } from '../gamification/gamification.service';

describe('ReferralService', () => {
  let service: ReferralService;

  const codeStore = new Map<string, UserReferralCode>();
  const referralStore: UserReferral[] = [];

  const codeRepository = {
    findOne: jest.fn(async ({ where }: { where: { userId?: string; code?: string } }) => {
      if (where.userId) return codeStore.get(where.userId) ?? null;
      for (const c of codeStore.values()) if (c.code === where.code) return c;
      return null;
    }),
    save: jest.fn(async (entity: UserReferralCode) => {
      codeStore.set(entity.userId, { ...entity, id: `code-${codeStore.size}`, createdAt: new Date() });
      return codeStore.get(entity.userId)!;
    }),
    create: jest.fn((dto: Partial<UserReferralCode>) => dto),
  };

  const referralRepository = {
    findOne: jest.fn(
      async ({ where }: { where: { referredUserId?: string; rewardGranted?: boolean } }) =>
        referralStore.find(
          (r) =>
            (!where.referredUserId || r.referredUserId === where.referredUserId) &&
            (where.rewardGranted === undefined || r.rewardGranted === where.rewardGranted),
        ) ?? null,
    ),
    find: jest.fn(async ({ where }: { where: { referrerId: string } }) =>
      referralStore.filter((r) => r.referrerId === where.referrerId),
    ),
    save: jest.fn(async (entity: UserReferral) => {
      const idx = referralStore.findIndex((r) => r.referredUserId === entity.referredUserId);
      const row = { ...entity, id: entity.id ?? `ref-${referralStore.length}`, createdAt: new Date() };
      if (idx >= 0) referralStore[idx] = row;
      else referralStore.push(row);
      return row;
    }),
    create: jest.fn((dto: Partial<UserReferral>) => dto),
  };

  const gamificationService = {
    awardPlatformXp: jest.fn().mockResolvedValue({ xp: 100, level: 1, awarded: 20, skippedReason: null }),
    unlockAchievement: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    codeStore.clear();
    referralStore.length = 0;
    jest.clearAllMocks();

    codeRepository.findOne.mockImplementation(
      async ({ where }: { where: { userId?: string; code?: string } }) => {
        if (where.userId) return codeStore.get(where.userId) ?? null;
        for (const c of codeStore.values()) if (c.code === where.code) return c;
        return null;
      },
    );
    codeRepository.save.mockImplementation(async (entity: UserReferralCode) => {
      codeStore.set(entity.userId, { ...entity, id: `code-${codeStore.size}`, createdAt: new Date() });
      return codeStore.get(entity.userId)!;
    });
    codeRepository.create.mockImplementation((dto: Partial<UserReferralCode>) => dto);

    referralRepository.findOne.mockImplementation(
      async ({ where }: { where: { referredUserId?: string; rewardGranted?: boolean } }) =>
        referralStore.find(
          (r) =>
            (!where.referredUserId || r.referredUserId === where.referredUserId) &&
            (where.rewardGranted === undefined || r.rewardGranted === where.rewardGranted),
        ) ?? null,
    );
    referralRepository.find.mockImplementation(
      async ({ where }: { where: { referrerId: string } }) =>
        referralStore.filter((r) => r.referrerId === where.referrerId),
    );
    referralRepository.save.mockImplementation(async (entity: UserReferral) => {
      const idx = referralStore.findIndex((r) => r.referredUserId === entity.referredUserId);
      const row = { ...entity, id: entity.id ?? `ref-${referralStore.length}`, createdAt: new Date() };
      if (idx >= 0) referralStore[idx] = row;
      else referralStore.push(row);
      return row;
    });
    referralRepository.create.mockImplementation((dto: Partial<UserReferral>) => dto);

    gamificationService.awardPlatformXp.mockResolvedValue({ xp: 100, level: 1, awarded: 20, skippedReason: null });
    gamificationService.unlockAchievement.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        { provide: getRepositoryToken(UserReferralCode), useValue: codeRepository },
        { provide: getRepositoryToken(UserReferral), useValue: referralRepository },
        { provide: GamificationService, useValue: gamificationService },
      ],
    }).compile();

    service = module.get(ReferralService);
  });

  it('generates a unique code for a new user', async () => {
    const code = await service.getOrCreateCode('u1');
    expect(code).toHaveLength(8);
    expect(typeof code).toBe('string');
  });

  it('returns existing code on second call (idempotent)', async () => {
    const first = await service.getOrCreateCode('u1');
    const second = await service.getOrCreateCode('u1');
    expect(first).toBe(second);
    expect(codeRepository.save).toHaveBeenCalledTimes(1);
  });

  it('records a valid referral claim', async () => {
    // First create referrer code
    codeStore.set('referrer1', { id: 'c1', userId: 'referrer1', code: 'ABCD1234', createdAt: new Date() });
    await service.claimReferral('ABCD1234', 'newuser1');
    expect(referralStore).toHaveLength(1);
    expect(referralStore[0].referrerId).toBe('referrer1');
    expect(referralStore[0].referredUserId).toBe('newuser1');
  });

  it('ignores unknown referral codes', async () => {
    await service.claimReferral('UNKNOWN0', 'newuser1');
    expect(referralStore).toHaveLength(0);
  });

  it('prevents self-referral', async () => {
    codeStore.set('u1', { id: 'c1', userId: 'u1', code: 'SELF1234', createdAt: new Date() });
    await service.claimReferral('SELF1234', 'u1');
    expect(referralStore).toHaveLength(0);
  });

  it('prevents duplicate referral for the same referred user', async () => {
    codeStore.set('referrer1', { id: 'c1', userId: 'referrer1', code: 'ABCD1234', createdAt: new Date() });
    await service.claimReferral('ABCD1234', 'newuser1');
    // Second claim for same newuser1 should be no-op
    codeStore.set('referrer2', { id: 'c2', userId: 'referrer2', code: 'WXYZ5678', createdAt: new Date() });
    await service.claimReferral('WXYZ5678', 'newuser1');
    expect(referralStore).toHaveLength(1);
  });

  it('grants reward and marks referral completed', async () => {
    referralStore.push({
      id: 'ref-1', referrerId: 'referrer1', referredUserId: 'newuser1',
      referralCode: 'ABCD1234', status: ReferralStatus.PENDING,
      rewardGranted: false, createdAt: new Date(),
    });
    const result = await service.grantReward('newuser1');
    expect(result.rewarded).toBe(true);
    expect(result.referrerId).toBe('referrer1');
    expect(gamificationService.awardPlatformXp).toHaveBeenCalled();
    expect(referralStore[0].rewardGranted).toBe(true);
  });

  it('returns rewarded=false when no pending referral found', async () => {
    const result = await service.grantReward('nobody');
    expect(result.rewarded).toBe(false);
    expect(result.referrerId).toBeNull();
  });

  it('getStats returns code and counts', async () => {
    codeStore.set('u1', { id: 'c1', userId: 'u1', code: 'MYCODE12', createdAt: new Date() });
    referralStore.push(
      { id: 'r1', referrerId: 'u1', referredUserId: 'n1', referralCode: 'MYCODE12', status: ReferralStatus.COMPLETED, rewardGranted: true, createdAt: new Date() },
      { id: 'r2', referrerId: 'u1', referredUserId: 'n2', referralCode: 'MYCODE12', status: ReferralStatus.PENDING, rewardGranted: false, createdAt: new Date() },
    );
    const stats = await service.getStats('u1');
    expect(stats.code).toBe('MYCODE12');
    expect(stats.totalReferrals).toBe(2);
    expect(stats.completedReferrals).toBe(1);
    expect(stats.pendingReferrals).toBe(1);
  });
});
