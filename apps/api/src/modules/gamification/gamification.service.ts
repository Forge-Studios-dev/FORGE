import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import Redis from 'ioredis';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  MemberBadge,
  MemberXp,
  PlatformXp,
  PlatformXpGrant,
  UserAchievement,
} from './entities/gamification.entity';

export enum PlatformXpAction {
  VIDEO_UPLOAD = 'video_upload',
  COURSE_PUBLISH = 'course_publish',
  POST_CREATE = 'post_create',
  LESSON_COMPLETE = 'lesson_complete',
  PLATFORM_CHECKIN = 'platform_checkin',
  COMMENT_CREATE = 'comment_create',
  COURSE_ENROLL = 'course_enroll',
  LIVE_ATTEND = 'live_attend',
  REFERRAL_SUCCESS = 'referral_success',
}

/** Max total XP any user can earn across all actions in a single calendar day. */
const GLOBAL_DAILY_XP_CAP = 500;
/** Max XP grants allowed within any 60-second window (velocity / anti-burst guard). */
const XP_VELOCITY_WINDOW_SEC = 60;
const XP_VELOCITY_LIMIT = 5;

/** Max community-scoped XP grants within any 60-second window (chat/post spam has no rate limit of its own). */
const COMMUNITY_XP_VELOCITY_WINDOW_SEC = 60;
const COMMUNITY_XP_VELOCITY_LIMIT = 10;

/** Per-source daily cap for community-scoped XP — mirrors awardPlatformXp's anti-farm pattern for activity sources that would otherwise let a user farm unlimited XP by spamming posts/messages. */
const COMMUNITY_XP_SOURCE_DAILY_CAP: Record<string, number> = {
  community_post: 10,
  community_post_comment: 30,
  channel_message: 50,
  room_message: 50,
};

const PLATFORM_XP_CONFIG: Record<string, { xp: number; dailyLimit: number }> = {
  [PlatformXpAction.VIDEO_UPLOAD]: { xp: 50, dailyLimit: 1 },
  [PlatformXpAction.COURSE_PUBLISH]: { xp: 100, dailyLimit: 1 },
  [PlatformXpAction.POST_CREATE]: { xp: 5, dailyLimit: 10 },
  [PlatformXpAction.LESSON_COMPLETE]: { xp: 15, dailyLimit: 5 },
  [PlatformXpAction.PLATFORM_CHECKIN]: { xp: 10, dailyLimit: 1 },
  [PlatformXpAction.COMMENT_CREATE]: { xp: 3, dailyLimit: 20 },
  [PlatformXpAction.COURSE_ENROLL]: { xp: 20, dailyLimit: 3 },
  [PlatformXpAction.LIVE_ATTEND]: { xp: 10, dailyLimit: 3 },
  [PlatformXpAction.REFERRAL_SUCCESS]: { xp: 100, dailyLimit: 20 },
};

/** Bonus XP awarded at streak milestone days (platform check-in). */
const STREAK_MILESTONE_BONUS: Record<number, number> = {
  7: 50,
  14: 75,
  30: 150,
  60: 300,
  100: 500,
  180: 1000,
  365: 2000,
};

export interface AchievementDefinition {
  key: string;
  title: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  { key: 'first_video', title: 'First Upload', description: 'Upload your first video', icon: '🎬' },
  { key: 'first_course', title: 'Educator', description: 'Publish your first course', icon: '📚' },
  { key: 'first_community', title: 'Community Builder', description: 'Create your first community', icon: '🏗️' },
  { key: 'first_live', title: 'Going Live', description: 'Host your first live stream', icon: '🔴' },
  { key: 'streak_7', title: 'Week Warrior', description: 'Check in 7 days in a row', icon: '🔥' },
  { key: 'streak_30', title: 'Monthly Dedication', description: 'Check in 30 days in a row', icon: '💎' },
  { key: 'streak_100', title: 'Centurion', description: 'Check in 100 days in a row', icon: '🏆' },
  { key: 'streak_180', title: 'Half-Year Hero', description: 'Check in 180 days in a row', icon: '🌙' },
  { key: 'streak_365', title: 'Legendary', description: 'Check in 365 days in a row', icon: '👑' },
  { key: 'anniversary_1', title: 'One Year', description: 'One year on FORGE', icon: '🎂' },
  { key: 'anniversary_2', title: 'Two Years', description: 'Two years on FORGE', icon: '🎉' },
  { key: 'loyalty_bronze', title: 'Loyal Member', description: 'Active for 90 days in any community', icon: '🥉' },
  { key: 'loyalty_silver', title: 'Dedicated Member', description: 'Active for 180 days in any community', icon: '🥈' },
  { key: 'loyalty_gold', title: 'Foundation Member', description: 'Active for 365 days in any community', icon: '🥇' },
  { key: 'level_10', title: 'Platform Pro', description: 'Reach platform level 10', icon: '⭐' },
  { key: 'level_25', title: 'Elite Creator', description: 'Reach platform level 25', icon: '🌟' },
  { key: 'subscriber_10', title: 'First Fans', description: 'Earn 10 subscribers', icon: '👥' },
  { key: 'subscriber_100', title: 'Century Club', description: 'Earn 100 subscribers', icon: '💯' },
  { key: 'subscriber_1000', title: 'Thousand Strong', description: 'Earn 1,000 subscribers', icon: '🎯' },
  { key: 'course_complete', title: 'Lifelong Learner', description: 'Complete your first course', icon: '🎓' },
  { key: 'community_xp_1000', title: 'Community Champion', description: 'Earn 1,000 XP in a community', icon: '🏅' },
  { key: 'first_referral', title: 'Talent Scout', description: 'Refer your first friend to FORGE', icon: '🤝' },
];

const ACHIEVEMENT_CATALOG_MAP = new Map(ACHIEVEMENT_CATALOG.map((a) => [a.key, a]));

const LEVEL_BADGES: Record<number, string> = {
  5: 'level_5',
  10: 'level_10',
  25: 'level_25',
};

const STREAK_BADGES: Record<number, string> = {
  7: 'streak_7',
  30: 'streak_30',
  100: 'streak_100',
  180: 'streak_180',
  365: 'streak_365',
};

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    @InjectRepository(MemberXp) private readonly xpRepository: Repository<MemberXp>,
    @InjectRepository(MemberBadge) private readonly badgeRepository: Repository<MemberBadge>,
    @InjectRepository(PlatformXp) private readonly platformXpRepository: Repository<PlatformXp>,
    @InjectRepository(PlatformXpGrant)
    private readonly grantRepository: Repository<PlatformXpGrant>,
    @InjectRepository(UserAchievement)
    private readonly achievementRepository: Repository<UserAchievement>,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    @InjectDataSource() private readonly dataSource: DataSource,
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

  async awardXp(
    userId: string,
    communityId: string,
    amount: number,
    source?: string,
  ): Promise<{ xp: number; level: number; streak: number; awarded: number; skippedReason: string | null }> {
    const velocityKey = `xp:community:velocity:${userId}:${communityId}`;
    const velocityCount = await this.redis.incr(velocityKey);
    if (velocityCount === 1) {
      await this.redis.expire(velocityKey, COMMUNITY_XP_VELOCITY_WINDOW_SEC);
    }
    if (velocityCount > COMMUNITY_XP_VELOCITY_LIMIT) {
      this.logger.warn(
        `community_xp_velocity_blocked userId=${userId} communityId=${communityId} source=${source ?? 'unknown'}`,
      );
      const profile = await this.getProfile(userId, communityId);
      return { ...profile, awarded: 0, skippedReason: 'velocity_limit_reached' };
    }

    const dailyCap = source ? COMMUNITY_XP_SOURCE_DAILY_CAP[source] : undefined;
    if (dailyCap) {
      const today = new Date().toISOString().slice(0, 10);
      const dailyKey = `xp:community:daily:${userId}:${communityId}:${source}:${today}`;
      const dailyCount = await this.redis.incr(dailyKey);
      if (dailyCount === 1) {
        await this.redis.expire(dailyKey, 60 * 60 * 24);
      }
      if (dailyCount > dailyCap) {
        this.logger.warn(
          `community_xp_daily_cap_blocked userId=${userId} communityId=${communityId} source=${source}`,
        );
        const profile = await this.getProfile(userId, communityId);
        return { ...profile, awarded: 0, skippedReason: 'daily_source_cap_reached' };
      }
    }

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
    await this.maybeAwardXpRoleBadges(userId, communityId, row.xp);
    return { xp: row.xp, level: row.level, streak: row.streak, awarded: amount, skippedReason: null };
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
    const qualifying = Object.entries(LEVEL_BADGES)
      .filter(([threshold]) => level >= Number(threshold))
      .map(([, key]) => key);
    await this.awardBadgesBatch(userId, communityId, qualifying);
  }

  private async maybeAwardStreakBadges(userId: string, communityId: string, streak: number) {
    const qualifying = Object.entries(STREAK_BADGES)
      .filter(([threshold]) => streak >= Number(threshold))
      .map(([, key]) => key);
    await this.awardBadgesBatch(userId, communityId, qualifying);
  }

  /** Awards all not-yet-held badges from `keys` in one read + one bulk insert instead of N sequential round-trips. */
  private async awardBadgesBatch(userId: string, communityId: string, keys: string[]) {
    if (keys.length === 0) return;
    const existing = await this.badgeRepository.find({
      where: { userId, communityId, badgeKey: In(keys) },
    });
    const existingKeys = new Set(existing.map((b) => b.badgeKey));
    const missing = keys.filter((key) => !existingKeys.has(key));
    if (missing.length === 0) return;
    await this.badgeRepository.insert(
      missing.map((badgeKey) => ({ userId, communityId, badgeKey })),
    );
  }

  /**
   * Discord-style XP roles: reads creator-configured badgeTiers from
   * community.settings.badgeTiers and auto-awards the highest qualifying tier badge.
   * Existing lower-tier badges are superseded (not removed — multi-badge display is additive).
   */
  private async maybeAwardXpRoleBadges(userId: string, communityId: string, xp: number) {
    const rows = await this.dataSource.query<Array<{ settings: Record<string, unknown> }>>(
      `SELECT settings FROM communities WHERE id = $1`,
      [communityId],
    );
    const settings = rows?.[0]?.settings as { badgeTiers?: Array<{ key: string; xpThreshold: number }> } | null;
    if (!settings?.badgeTiers?.length) return;

    const sorted = [...settings.badgeTiers].sort((a, b) => b.xpThreshold - a.xpThreshold);
    const earned = sorted.find((tier) => xp >= tier.xpThreshold);
    if (!earned) return;

    await this.awardBadge(userId, communityId, `role:${earned.key}`);
  }

  // ── Platform-wide XP ─────────────────────────────────────────────────────

  async getPlatformProfile(userId: string) {
    let row = await this.platformXpRepository.findOne({ where: { userId } });
    if (!row) {
      row = await this.platformXpRepository.save(
        this.platformXpRepository.create({ userId, xp: 0, level: 1, streak: 0, longestStreak: 0, lastCheckInAt: null }),
      );
    }
    return {
      userId,
      xp: row.xp,
      level: row.level,
      streak: row.streak,
      longestStreak: row.longestStreak,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Award platform XP for an action. Respects daily limits per action to
   * prevent farming. Returns { xp, level, awarded, skippedReason }.
   */
  async awardPlatformXp(
    userId: string,
    action: PlatformXpAction,
  ): Promise<{ xp: number; level: number; awarded: number; skippedReason: string | null }> {
    const config = PLATFORM_XP_CONFIG[action];
    if (!config) return { xp: 0, level: 1, awarded: 0, skippedReason: 'unknown_action' };

    const today = new Date().toISOString().slice(0, 10);

    // Velocity guard: block burst XP farming (> XP_VELOCITY_LIMIT grants per 60s)
    const velocityKey = `xp:velocity:${userId}`;
    const velocityCount = await this.redis.incr(velocityKey);
    if (velocityCount === 1) {
      await this.redis.expire(velocityKey, XP_VELOCITY_WINDOW_SEC);
    }
    if (velocityCount > XP_VELOCITY_LIMIT) {
      this.logger.warn(`xp_velocity_blocked userId=${userId} action=${action} count=${velocityCount}`);
      const profile = await this.getPlatformProfile(userId);
      return { ...profile, awarded: 0, skippedReason: 'velocity_limit_reached' };
    }

    // Global daily XP cap: sum XP awarded today across all actions
    const dailyXpRows = await this.grantRepository
      .createQueryBuilder('g')
      .select('SUM(g.xpAwarded)', 'total')
      .where('g.userId = :userId', { userId })
      .andWhere('g.grantedDate = :today', { today })
      .getRawOne<{ total: string | null }>();
    const dailyXpTotal = Number(dailyXpRows?.total ?? 0);
    if (dailyXpTotal + config.xp > GLOBAL_DAILY_XP_CAP) {
      const profile = await this.getPlatformProfile(userId);
      return { ...profile, awarded: 0, skippedReason: 'global_daily_cap_reached' };
    }

    const dailyCount = await this.grantRepository.count({
      where: { userId, actionType: action, grantedDate: today },
    });

    if (dailyCount >= config.dailyLimit) {
      const profile = await this.getPlatformProfile(userId);
      return { ...profile, awarded: 0, skippedReason: 'daily_limit_reached' };
    }

    let row = await this.platformXpRepository.findOne({ where: { userId } });
    if (!row) {
      row = await this.platformXpRepository.save(
        this.platformXpRepository.create({ userId, xp: 0, level: 1 }),
      );
    }
    const levelBefore = row.level;
    row.xp += config.xp;
    row.level = Math.max(1, Math.floor(row.xp / 200) + 1);
    await this.platformXpRepository.save(row);

    await this.grantRepository.save(
      this.grantRepository.create({
        userId,
        actionType: action,
        xpAwarded: config.xp,
        grantedDate: today,
      }),
    );

    if (row.level > levelBefore) {
      this.eventEmitter.emit('gamification.level_up', {
        userId,
        level: row.level,
        xp: row.xp,
      });
    }

    return { xp: row.xp, level: row.level, awarded: config.xp, skippedReason: null };
  }

  async platformLeaderboard(limit = 20) {
    const take = Math.min(limit, 100);
    const rows = await this.platformXpRepository.find({
      order: { xp: 'DESC' },
      take,
    });
    return rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      xp: r.xp,
      level: r.level,
    }));
  }

  // ── Achievements ─────────────────────────────────────────────────────────

  /**
   * Attempt to unlock an achievement for a user. No-op if already earned.
   * Returns the achievement definition if newly unlocked, null if already had it.
   */
  async unlockAchievement(
    userId: string,
    key: string,
  ): Promise<AchievementDefinition | null> {
    const def = ACHIEVEMENT_CATALOG_MAP.get(key);
    if (!def) return null;
    const existing = await this.achievementRepository.findOne({
      where: { userId, key },
    });
    if (existing) return null;
    await this.achievementRepository.save(
      this.achievementRepository.create({ userId, key }),
    );
    this.eventEmitter.emit('gamification.achievement_unlocked', {
      userId,
      key,
      title: def.title,
      icon: def.icon,
    });
    return def;
  }

  /** List all achievements for a user, annotated with earned state. */
  async listAchievements(userId: string): Promise<
    Array<AchievementDefinition & { earned: boolean; earnedAt: Date | null }>
  > {
    const earned = await this.achievementRepository.find({ where: { userId } });
    const earnedMap = new Map(earned.map((a) => [a.key, a.earnedAt]));
    return ACHIEVEMENT_CATALOG.map((def) => ({
      ...def,
      earned: earnedMap.has(def.key),
      earnedAt: earnedMap.get(def.key) ?? null,
    }));
  }

  /**
   * Check platform state and unlock any newly eligible achievements.
   * Call after major events (level up, streak update, subscriber milestone).
   */
  async checkAndUnlockPlatformAchievements(
    userId: string,
    context: {
      platformLevel?: number;
      platformStreak?: number;
      subscriberCount?: number;
    },
  ): Promise<AchievementDefinition[]> {
    const unlocked: AchievementDefinition[] = [];

    if (context.platformLevel != null) {
      if (context.platformLevel >= 10) {
        const r = await this.unlockAchievement(userId, 'level_10');
        if (r) unlocked.push(r);
      }
      if (context.platformLevel >= 25) {
        const r = await this.unlockAchievement(userId, 'level_25');
        if (r) unlocked.push(r);
      }
    }

    if (context.platformStreak != null) {
      if (context.platformStreak >= 7) {
        const r = await this.unlockAchievement(userId, 'streak_7');
        if (r) unlocked.push(r);
      }
      if (context.platformStreak >= 30) {
        const r = await this.unlockAchievement(userId, 'streak_30');
        if (r) unlocked.push(r);
      }
      if (context.platformStreak >= 100) {
        const r = await this.unlockAchievement(userId, 'streak_100');
        if (r) unlocked.push(r);
      }
    }

    if (context.subscriberCount != null) {
      if (context.subscriberCount >= 10) {
        const r = await this.unlockAchievement(userId, 'subscriber_10');
        if (r) unlocked.push(r);
      }
      if (context.subscriberCount >= 100) {
        const r = await this.unlockAchievement(userId, 'subscriber_100');
        if (r) unlocked.push(r);
      }
      if (context.subscriberCount >= 1000) {
        const r = await this.unlockAchievement(userId, 'subscriber_1000');
        if (r) unlocked.push(r);
      }
    }

    return unlocked;
  }

  /**
   * Platform check-in: awards daily XP, maintains streak, and grants
   * milestone bonus XP at 7 / 14 / 30 / 60 / 100-day streak thresholds.
   */
  async platformCheckIn(
    userId: string,
  ): Promise<{
    xp: number;
    level: number;
    streak: number;
    longestStreak: number;
    awarded: number;
    bonusAwarded: number;
    alreadyCheckedIn: boolean;
    skippedReason: string | null;
  }> {
    const today = new Date().toISOString().slice(0, 10);

    let row = await this.platformXpRepository.findOne({ where: { userId } });
    if (!row) {
      row = await this.platformXpRepository.save(
        this.platformXpRepository.create({ userId, xp: 0, level: 1, streak: 0, longestStreak: 0, lastCheckInAt: null }),
      );
    }

    if (row.lastCheckInAt === today) {
      return {
        xp: row.xp,
        level: row.level,
        streak: row.streak,
        longestStreak: row.longestStreak,
        awarded: 0,
        bonusAwarded: 0,
        alreadyCheckedIn: true,
        skippedReason: null,
      };
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    row.streak = row.lastCheckInAt === yesterdayStr ? row.streak + 1 : 1;
    row.longestStreak = Math.max(row.longestStreak, row.streak);
    row.lastCheckInAt = today;

    const baseXp = PLATFORM_XP_CONFIG[PlatformXpAction.PLATFORM_CHECKIN].xp;
    const bonusXp = STREAK_MILESTONE_BONUS[row.streak] ?? 0;
    row.xp += baseXp + bonusXp;
    row.level = Math.max(1, Math.floor(row.xp / 200) + 1);
    await this.platformXpRepository.save(row);

    await this.grantRepository.save(
      this.grantRepository.create({
        userId,
        actionType: PlatformXpAction.PLATFORM_CHECKIN,
        xpAwarded: baseXp + bonusXp,
        grantedDate: today,
      }),
    );

    // Long-term retention milestone check (async, non-blocking)
    void this.checkLongTermRetentionMilestones(userId).catch((e: Error) =>
      this.logger.warn(`Retention milestone check failed: ${e.message}`),
    );

    return {
      xp: row.xp,
      level: row.level,
      streak: row.streak,
      longestStreak: row.longestStreak,
      awarded: baseXp,
      bonusAwarded: bonusXp,
      alreadyCheckedIn: false,
      skippedReason: null,
    };
  }

  /**
   * Composite reputation score (0–1000) derived from:
   * - Platform XP (40%): normalized against soft cap of 10,000 XP
   * - Followers (30%): log-scaled, capped at 10,000
   * - Content count (20%): video count, capped at 100
   * - Achievements (10%): count of unlocked achievements, capped at 14
   */
  async getReputationScore(userId: string): Promise<{
    score: number;
    breakdown: { xpScore: number; followScore: number; contentScore: number; achievementScore: number };
    platformXp: number;
    followerCount: number;
    videoCount: number;
    achievementCount: number;
  }> {
    const [platformXpRow, followerRow, videoRow, achievementRow] = await Promise.all([
      this.dataSource.query<{ xp: string | null }[]>(
        `SELECT xp FROM platform_xp WHERE user_id = $1 LIMIT 1`,
        [userId],
      ),
      this.dataSource.query<{ count: string }[]>(
        `SELECT follower_count::int AS count FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      ),
      this.dataSource.query<{ count: string }[]>(
        `SELECT video_count::int AS count FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      ),
      this.dataSource.query<{ count: string }[]>(
        `SELECT COUNT(*)::int AS count FROM user_achievements WHERE user_id = $1`,
        [userId],
      ),
    ]);

    const platformXp = Number(platformXpRow?.[0]?.xp ?? 0);
    const followerCount = Number(followerRow?.[0]?.count ?? 0);
    const videoCount = Number(videoRow?.[0]?.count ?? 0);
    const achievementCount = Number(achievementRow?.[0]?.count ?? 0);

    const xpScore = Math.min(400, Math.round((platformXp / 10_000) * 400));
    const followScore = followerCount > 0
      ? Math.min(300, Math.round((Math.log10(followerCount + 1) / Math.log10(10_001)) * 300))
      : 0;
    const contentScore = Math.min(200, Math.round((videoCount / 100) * 200));
    const achievementScore = Math.min(100, Math.round((achievementCount / 14) * 100));
    const score = xpScore + followScore + contentScore + achievementScore;

    return {
      score,
      breakdown: { xpScore, followScore, contentScore, achievementScore },
      platformXp,
      followerCount,
      videoCount,
      achievementCount,
    };
  }

  /** Gamification analytics for creator: XP activity trend, top earners, achievement distribution. */
  async getGamificationAnalytics(userId: string): Promise<{
    platformXp: number;
    platformLevel: number;
    streak: number;
    longestStreak: number;
    achievementsUnlocked: number;
    achievementsTotal: number;
    reputationScore: number;
    xpLast7Days: { date: string; xp: number }[];
    topActions: { action: string; total: number }[];
  }> {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const profile = await this.getPlatformProfile(userId);
    const reputation = await this.getReputationScore(userId);
    const achievementCount = await this.achievementRepository.count({ where: { userId } });

    const [xpTrend, topActions] = await Promise.all([
      this.dataSource.query<{ day: string; xp: string }[]>(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                SUM(xp_awarded)::int AS xp
         FROM platform_xp_grants
         WHERE user_id = $1 AND created_at >= $2
         GROUP BY 1 ORDER BY 1`,
        [userId, since7d],
      ),
      this.dataSource.query<{ action: string; total: string }[]>(
        `SELECT action_type AS action, SUM(xp_awarded)::int AS total
         FROM platform_xp_grants
         WHERE user_id = $1
         GROUP BY action_type ORDER BY total DESC LIMIT 5`,
        [userId],
      ),
    ]);

    return {
      platformXp: profile.xp,
      platformLevel: profile.level,
      streak: profile.streak,
      longestStreak: profile.longestStreak,
      achievementsUnlocked: achievementCount,
      achievementsTotal: ACHIEVEMENT_CATALOG.length,
      reputationScore: reputation.score,
      xpLast7Days: xpTrend.map((r) => ({ date: r.day, xp: Number(r.xp) })),
      topActions: topActions.map((r) => ({ action: r.action, total: Number(r.total) })),
    };
  }

  // ── YouTube-style milestone listener (P11-T021) ──────────────────────────
  @OnEvent('follow.created', { async: true })
  async onFollowCreated(payload: { followerId: string; followingId: string }) {
    try {
      await this.checkAndUnlockPlatformAchievements(payload.followingId, {});
    } catch (e) {
      this.logger.warn(`milestone check failed for ${payload.followingId}: ${(e as Error).message}`);
    }
  }

  // ── P10-T017: Long-term retention loops ──────────────────────────────────

  async checkLongTermRetentionMilestones(userId: string): Promise<void> {
    const rows = await this.dataSource.query<[{ age_days: string }]>(
      `SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 AS age_days FROM users WHERE id = $1`,
      [userId],
    );
    if (!rows?.[0]) return;
    const ageDays = Math.floor(parseFloat(rows[0].age_days));

    // Account anniversary badges (check on each checkin)
    const anniversaryBadges: Array<{ days: number; key: string; xp: number }> = [
      { days: 365, key: 'anniversary_1', xp: 500 },
      { days: 730, key: 'anniversary_2', xp: 1000 },
    ];
    for (const milestone of anniversaryBadges) {
      if (ageDays >= milestone.days) {
        const existing = await this.dataSource.query<{ badge_key: string }[]>(
          `SELECT badge_key FROM member_badges WHERE user_id = $1 AND community_id IS NULL AND badge_key = $2`,
          [userId, milestone.key],
        ).catch(() => [] as { badge_key: string }[]);
        if (!existing.length) {
          await this.dataSource.query(
            `INSERT INTO member_badges (user_id, community_id, badge_key) VALUES ($1, NULL, $2) ON CONFLICT DO NOTHING`,
            [userId, milestone.key],
          ).catch(() => {});
          // Award XP to a platform-level context (use any community the user is in)
          this.logger.log(`Anniversary badge ${milestone.key} awarded to user ${userId}`);
          void this.eventEmitter.emit('gamification.anniversary', { userId, badge: milestone.key });
        }
      }
    }

    // Community loyalty badges based on longest active membership
    await this.checkCommunityLoyaltyBadges(userId);
  }

  private async checkCommunityLoyaltyBadges(userId: string): Promise<void> {
    const longestMembership = await this.dataSource.query<[{ age_days: string; community_id: string }]>(
      `SELECT community_id, EXTRACT(EPOCH FROM (NOW() - joined_at)) / 86400 AS age_days
       FROM community_members WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1`,
      [userId],
    );
    if (!longestMembership?.[0]) return;
    const agedays = Math.floor(parseFloat(longestMembership[0].age_days));
    const communityId = longestMembership[0].community_id;

    const loyaltyTiers = [
      { days: 365, key: 'loyalty_gold' },
      { days: 180, key: 'loyalty_silver' },
      { days: 90, key: 'loyalty_bronze' },
    ];
    for (const tier of loyaltyTiers) {
      if (agedays >= tier.days) {
        await this.awardBadge(userId, communityId, tier.key).catch(() => {});
        break;
      }
    }
  }

  getLongTermAchievements() {
    return ACHIEVEMENT_CATALOG.filter((a) =>
      ['streak_180', 'streak_365', 'anniversary_1', 'anniversary_2', 'loyalty_bronze', 'loyalty_silver', 'loyalty_gold'].includes(a.key),
    );
  }
}
