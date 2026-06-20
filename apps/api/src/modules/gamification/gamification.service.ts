import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemberBadge, MemberXp } from './entities/gamification.entity';

const LEVEL_BADGES: Record<number, string> = {
  5: 'level_5',
  10: 'level_10',
  25: 'level_25',
};

const STREAK_BADGES: Record<number, string> = {
  7: 'streak_7',
  30: 'streak_30',
};

@Injectable()
export class GamificationService {
  constructor(
    @InjectRepository(MemberXp) private readonly xpRepository: Repository<MemberXp>,
    @InjectRepository(MemberBadge) private readonly badgeRepository: Repository<MemberBadge>,
  ) {}

  async getProfile(userId: string, communityId: string) {
    let xp = await this.xpRepository.findOne({ where: { userId, communityId } });
    if (!xp) {
      xp = await this.xpRepository.save(
        this.xpRepository.create({ userId, communityId, xp: 0, level: 1, streak: 0 }),
      );
    }
    const badges = await this.badgeRepository.find({ where: { userId, communityId } });
    return {
      xp: xp.xp,
      level: xp.level,
      streak: xp.streak,
      badges: badges.map((b) => b.badgeKey),
    };
  }

  async awardXp(userId: string, communityId: string, amount: number) {
    const xp = await this.xpRepository.findOne({ where: { userId, communityId } });
    const row =
      xp ??
      (await this.xpRepository.save(
        this.xpRepository.create({ userId, communityId, xp: 0, level: 1, streak: 0 }),
      ));
    row.xp += amount;
    row.level = Math.max(1, Math.floor(row.xp / 100) + 1);
    await this.xpRepository.save(row);
    await this.maybeAwardLevelBadges(userId, communityId, row.level);
    return { xp: row.xp, level: row.level, streak: row.streak };
  }

  async checkIn(userId: string, communityId: string) {
    const today = new Date().toISOString().slice(0, 10);
    let xp = await this.xpRepository.findOne({ where: { userId, communityId } });
    if (!xp) {
      xp = await this.xpRepository.save(
        this.xpRepository.create({ userId, communityId, xp: 0, level: 1, streak: 0 }),
      );
    }

    const lastCheckIn = xp.lastCheckInAt
      ? new Date(xp.lastCheckInAt).toISOString().slice(0, 10)
      : null;

    if (lastCheckIn === today) {
      return {
        xp: xp.xp,
        level: xp.level,
        streak: xp.streak,
        alreadyCheckedIn: true,
        badges: (await this.badgeRepository.find({ where: { userId, communityId } })).map(
          (b) => b.badgeKey,
        ),
      };
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (lastCheckIn === yesterdayStr) {
      xp.streak += 1;
    } else {
      xp.streak = 1;
    }
    xp.lastCheckInAt = today;
    xp.xp += 10;
    xp.level = Math.max(1, Math.floor(xp.xp / 100) + 1);
    await this.xpRepository.save(xp);
    await this.maybeAwardLevelBadges(userId, communityId, xp.level);
    await this.maybeAwardStreakBadges(userId, communityId, xp.streak);

    const badges = await this.badgeRepository.find({ where: { userId, communityId } });
    return {
      xp: xp.xp,
      level: xp.level,
      streak: xp.streak,
      alreadyCheckedIn: false,
      badges: badges.map((b) => b.badgeKey),
    };
  }

  async awardBadge(userId: string, communityId: string, badgeKey: string) {
    const existing = await this.badgeRepository.findOne({
      where: { userId, communityId, badgeKey },
    });
    if (existing) return existing;
    return this.badgeRepository.save(
      this.badgeRepository.create({ userId, communityId, badgeKey }),
    );
  }

  async leaderboard(communityId: string, limit = 10) {
    const rows = await this.xpRepository.find({
      where: { communityId },
      order: { xp: 'DESC' },
      take: limit,
    });
    return rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      xp: r.xp,
      level: r.level,
      streak: r.streak,
    }));
  }

  private async maybeAwardLevelBadges(userId: string, communityId: string, level: number) {
    for (const [threshold, key] of Object.entries(LEVEL_BADGES)) {
      if (level >= Number(threshold)) {
        await this.awardBadge(userId, communityId, key);
      }
    }
  }

  private async maybeAwardStreakBadges(userId: string, communityId: string, streak: number) {
    for (const [threshold, key] of Object.entries(STREAK_BADGES)) {
      if (streak >= Number(threshold)) {
        await this.awardBadge(userId, communityId, key);
      }
    }
  }
}
