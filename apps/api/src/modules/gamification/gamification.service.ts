import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemberBadge, MemberXp } from './entities/gamification.entity';

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
    const profile = await this.getProfile(userId, communityId);
    const xp = await this.xpRepository.findOneOrFail({ where: { userId, communityId } });
    xp.xp = profile.xp + amount;
    xp.level = Math.max(1, Math.floor(xp.xp / 100) + 1);
    await this.xpRepository.save(xp);
    return { xp: xp.xp, level: xp.level };
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
    }));
  }
}
