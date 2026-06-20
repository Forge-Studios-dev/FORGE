import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GamificationService } from './gamification.service';
import { MemberBadge, MemberXp } from './entities/gamification.entity';

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

  beforeEach(async () => {
    xpStore.clear();
    badgeStore.length = 0;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: getRepositoryToken(MemberXp), useValue: xpRepository },
        { provide: getRepositoryToken(MemberBadge), useValue: badgeRepository },
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
});
