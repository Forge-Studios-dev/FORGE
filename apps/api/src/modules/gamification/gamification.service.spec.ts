import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GamificationService, PlatformXpAction } from './gamification.service';
import { MemberBadge, MemberXp, PlatformXp, PlatformXpGrant, UserAchievement } from './entities/gamification.entity';

describe('GamificationService', () => {
  let service: GamificationService;
  const xpStore = new Map<string, MemberXp>();
  const badgeStore: MemberBadge[] = [];

  const xpRepository = {
    findOne: jest.fn(async ({ where }: { where: { userId: string; communityId: string } }) =>
      xpStore.get(`${where.userId}:${where.communityId}`) ?? null,
    ),
    save: jest.fn(async (entity: MemberXp) => {
      const key = `${entity.userId}:${entity.communityId}`;
      xpStore.set(key, { ...entity, id: entity.id ?? 'xp-1' });
      return xpStore.get(key)!;
    }),
    findOneOrFail: jest.fn(async ({ where }: { where: { userId: string; communityId: string } }) => {
      const row = xpStore.get(`${where.userId}:${where.communityId}`);
      if (!row) throw new Error('not found');
      return row;
    }),
    find: jest.fn(),
    create: jest.fn((dto: Partial<MemberXp>) => ({
      ...dto,
      id: 'xp-1',
      xp: dto.xp ?? 0,
      level: dto.level ?? 1,
      streak: dto.streak ?? 0,
    })),
  };

  const badgeRepository = {
    find: jest.fn(async ({ where }: { where: { userId: string; communityId: string } }) =>
      badgeStore.filter(
        (b) => b.userId === where.userId && b.communityId === where.communityId,
      ),
    ),
    findOne: jest.fn(async ({ where }: { where: { userId: string; communityId: string; badgeKey: string } }) =>
      badgeStore.find(
        (b) =>
          b.userId === where.userId &&
          b.communityId === where.communityId &&
          b.badgeKey === where.badgeKey,
      ) ?? null,
    ),
    save: jest.fn(async (entity: MemberBadge) => {
      badgeStore.push({ ...entity, id: entity.id ?? `badge-${badgeStore.length}` });
      return badgeStore[badgeStore.length - 1];
    }),
    create: jest.fn((dto: Partial<MemberXp>) => ({
      ...dto,
      id: 'xp-1',
      xp: dto.xp ?? 0,
      level: dto.level ?? 1,
      streak: dto.streak ?? 0,
    })),
  };

  const platformXpStore = new Map<string, PlatformXp>();
  const grantStore: PlatformXpGrant[] = [];

  const platformXpRepository = {
    findOne: jest.fn(async ({ where }: { where: { userId: string } }) =>
      platformXpStore.get(where.userId) ?? null,
    ),
    save: jest.fn(async (entity: PlatformXp) => {
      platformXpStore.set(entity.userId, { ...entity, id: entity.id ?? 'pxp-1', streak: entity.streak ?? 0, longestStreak: entity.longestStreak ?? 0, lastCheckInAt: entity.lastCheckInAt ?? null });
      return platformXpStore.get(entity.userId)!;
    }),
    create: jest.fn((dto: Partial<PlatformXp>) => ({ streak: 0, longestStreak: 0, lastCheckInAt: null, ...dto, id: 'pxp-1' })),
    find: jest.fn(async () => [...platformXpStore.values()]),
  };

  const grantRepository = {
    count: jest.fn(async () => grantStore.length),
    save: jest.fn(async (entity: PlatformXpGrant) => {
      grantStore.push({ ...entity, id: `grant-${grantStore.length}` });
      return grantStore[grantStore.length - 1];
    }),
    create: jest.fn((dto: Partial<PlatformXpGrant>) => dto),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    })),
  };

  const achievementStore: UserAchievement[] = [];
  const achievementRepository = {
    findOne: jest.fn(async ({ where }: { where: { userId: string; key: string } }) =>
      achievementStore.find((a) => a.userId === where.userId && a.key === where.key) ?? null,
    ),
    find: jest.fn(async ({ where }: { where: { userId: string } }) =>
      achievementStore.filter((a) => a.userId === where.userId),
    ),
    save: jest.fn(async (entity: UserAchievement) => {
      achievementStore.push({ ...entity, id: `ach-${achievementStore.length}`, earnedAt: new Date() });
      return achievementStore[achievementStore.length - 1];
    }),
    create: jest.fn((dto: Partial<UserAchievement>) => dto),
  };

  beforeEach(async () => {
    xpStore.clear();
    badgeStore.length = 0;
    platformXpStore.clear();
    grantStore.length = 0;
    achievementStore.length = 0;
    jest.clearAllMocks();

    // Reset count mock to 0 (no existing grants = under daily limit)
    grantRepository.count.mockResolvedValue(0);
    achievementRepository.findOne.mockImplementation(
      async ({ where }: { where: { userId: string; key: string } }) =>
        achievementStore.find((a) => a.userId === where.userId && a.key === where.key) ?? null,
    );
    achievementRepository.find.mockImplementation(
      async ({ where }: { where: { userId: string } }) =>
        achievementStore.filter((a) => a.userId === where.userId),
    );
    achievementRepository.save.mockImplementation(async (entity: UserAchievement) => {
      achievementStore.push({ ...entity, id: `ach-${achievementStore.length}`, earnedAt: new Date() });
      return achievementStore[achievementStore.length - 1];
    });
    achievementRepository.create.mockImplementation((dto: Partial<UserAchievement>) => dto);

    const redisMock = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: getRepositoryToken(MemberXp), useValue: xpRepository },
        { provide: getRepositoryToken(MemberBadge), useValue: badgeRepository },
        { provide: getRepositoryToken(PlatformXp), useValue: platformXpRepository },
        { provide: getRepositoryToken(PlatformXpGrant), useValue: grantRepository },
        { provide: getRepositoryToken(UserAchievement), useValue: achievementRepository },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redisMock },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: getDataSourceToken(), useValue: { query: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get(GamificationService);
  });

  it('awards XP and level badges at thresholds', async () => {
    await service.awardXp('u1', 'c1', 500);
    const profile = await service.getProfile('u1', 'c1');
    expect(profile.level).toBeGreaterThanOrEqual(5);
    expect(profile.badges).toContain('level_5');
  });

  it('dedupes daily check-in and increments streak', async () => {
    const first = await service.checkIn('u1', 'c1');
    expect(first.alreadyCheckedIn).toBe(false);
    expect(first.streak).toBe(1);

    const second = await service.checkIn('u1', 'c1');
    expect(second.alreadyCheckedIn).toBe(true);
    expect(second.streak).toBe(1);
  });

  describe('platform XP', () => {
    it('creates platform profile on first access', async () => {
      const profile = await service.getPlatformProfile('u1');
      expect(profile.xp).toBe(0);
      expect(profile.level).toBe(1);
    });

    it('awards XP for a valid action under daily limit', async () => {
      grantRepository.count.mockResolvedValue(0);
      const result = await service.awardPlatformXp('u1', PlatformXpAction.POST_CREATE);
      expect(result.awarded).toBe(5);
      expect(result.xp).toBe(5);
      expect(result.skippedReason).toBeNull();
    });

    it('skips XP when daily limit is reached', async () => {
      grantRepository.count.mockResolvedValue(10); // dailyLimit for post_create is 10
      const result = await service.awardPlatformXp('u1', PlatformXpAction.POST_CREATE);
      expect(result.awarded).toBe(0);
      expect(result.skippedReason).toBe('daily_limit_reached');
    });

    it('advances level after accumulating enough XP', async () => {
      grantRepository.count.mockResolvedValue(0);
      // Set existing XP close to level threshold (level 2 = 200 XP)
      platformXpStore.set('u1', { id: 'pxp-1', userId: 'u1', xp: 190, level: 1, streak: 0, longestStreak: 0, lastCheckInAt: null, updatedAt: new Date() });
      const result = await service.awardPlatformXp('u1', PlatformXpAction.VIDEO_UPLOAD);
      expect(result.xp).toBe(240);
      expect(result.level).toBe(2); // 240/200 + 1 = 2
    });

    it('awards video upload XP only once per day', async () => {
      grantRepository.count
        .mockResolvedValueOnce(0) // first call: under limit
        .mockResolvedValueOnce(1); // second call: at limit (dailyLimit=1)
      const first = await service.awardPlatformXp('u1', PlatformXpAction.VIDEO_UPLOAD);
      const second = await service.awardPlatformXp('u1', PlatformXpAction.VIDEO_UPLOAD);
      expect(first.awarded).toBe(50);
      expect(second.awarded).toBe(0);
    });

    it('returns empty leaderboard when no users', async () => {
      platformXpRepository.find.mockResolvedValue([]);
      const board = await service.platformLeaderboard();
      expect(board).toEqual([]);
    });

    it('platform check-in awards checkin XP', async () => {
      grantRepository.count.mockResolvedValue(0);
      const result = await service.platformCheckIn('u1');
      expect(result.awarded).toBe(10);
    });

    it('platform check-in increments streak on consecutive days', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      platformXpStore.set('u1', {
        id: 'pxp-1', userId: 'u1', xp: 50, level: 1, streak: 3,
        longestStreak: 3, lastCheckInAt: yesterday.toISOString().slice(0, 10),
        updatedAt: new Date(),
      });
      const result = await service.platformCheckIn('u1');
      expect(result.alreadyCheckedIn).toBe(false);
      expect(result.streak).toBe(4);
      expect(result.longestStreak).toBe(4);
    });

    it('platform check-in resets streak on gap', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      platformXpStore.set('u1', {
        id: 'pxp-1', userId: 'u1', xp: 100, level: 1, streak: 10,
        longestStreak: 10, lastCheckInAt: twoDaysAgo.toISOString().slice(0, 10),
        updatedAt: new Date(),
      });
      const result = await service.platformCheckIn('u1');
      expect(result.streak).toBe(1);
      expect(result.longestStreak).toBe(10); // preserved
    });

    it('platform check-in is idempotent same day', async () => {
      const today = new Date().toISOString().slice(0, 10);
      platformXpStore.set('u1', {
        id: 'pxp-1', userId: 'u1', xp: 50, level: 1, streak: 5,
        longestStreak: 5, lastCheckInAt: today, updatedAt: new Date(),
      });
      const result = await service.platformCheckIn('u1');
      expect(result.alreadyCheckedIn).toBe(true);
      expect(result.awarded).toBe(0);
    });

    it('awards milestone bonus XP at 7-day streak', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      platformXpStore.set('u1', {
        id: 'pxp-1', userId: 'u1', xp: 60, level: 1, streak: 6,
        longestStreak: 6, lastCheckInAt: yesterday.toISOString().slice(0, 10),
        updatedAt: new Date(),
      });
      const result = await service.platformCheckIn('u1');
      expect(result.streak).toBe(7);
      expect(result.bonusAwarded).toBe(50); // 7-day milestone bonus
      expect(result.awarded).toBe(10); // base check-in XP
    });

    it('getPlatformProfile includes streak fields', async () => {
      platformXpStore.set('u1', {
        id: 'pxp-1', userId: 'u1', xp: 100, level: 1, streak: 5,
        longestStreak: 12, lastCheckInAt: '2026-06-28', updatedAt: new Date(),
      });
      const profile = await service.getPlatformProfile('u1');
      expect(profile.streak).toBe(5);
      expect(profile.longestStreak).toBe(12);
    });

    describe('achievements', () => {
      it('unlocks a new achievement and returns its definition', async () => {
        const result = await service.unlockAchievement('u1', 'first_video');
        expect(result).not.toBeNull();
        expect(result?.key).toBe('first_video');
        expect(result?.title).toBe('First Upload');
      });

      it('returns null when achievement already earned', async () => {
        await service.unlockAchievement('u1', 'first_video');
        const second = await service.unlockAchievement('u1', 'first_video');
        expect(second).toBeNull();
      });

      it('returns null for unknown achievement key', async () => {
        const result = await service.unlockAchievement('u1', 'nonexistent_key');
        expect(result).toBeNull();
      });

      it('listAchievements returns full catalog with earned flag', async () => {
        await service.unlockAchievement('u1', 'first_video');
        const list = await service.listAchievements('u1');
        const video = list.find((a) => a.key === 'first_video');
        const course = list.find((a) => a.key === 'first_course');
        expect(video?.earned).toBe(true);
        expect(video?.earnedAt).not.toBeNull();
        expect(course?.earned).toBe(false);
        expect(course?.earnedAt).toBeNull();
      });

      it('checkAndUnlockPlatformAchievements unlocks streak milestones', async () => {
        const unlocked = await service.checkAndUnlockPlatformAchievements('u1', {
          platformStreak: 7,
        });
        expect(unlocked.some((a) => a.key === 'streak_7')).toBe(true);
        expect(unlocked.some((a) => a.key === 'streak_30')).toBe(false);
      });

      it('checkAndUnlockPlatformAchievements unlocks level and subscriber milestones', async () => {
        const unlocked = await service.checkAndUnlockPlatformAchievements('u1', {
          platformLevel: 25,
          subscriberCount: 100,
        });
        expect(unlocked.some((a) => a.key === 'level_10')).toBe(true);
        expect(unlocked.some((a) => a.key === 'level_25')).toBe(true);
        expect(unlocked.some((a) => a.key === 'subscriber_10')).toBe(true);
        expect(unlocked.some((a) => a.key === 'subscriber_100')).toBe(true);
        expect(unlocked.some((a) => a.key === 'subscriber_1000')).toBe(false);
      });
    });
  });
});
