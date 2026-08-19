import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isSkillEconomyLmsEnabled } from '../../common/features/skill-economy-lms';
import { UserReferral, UserReferralCode, ReferralStatus } from './entities/referral.entity';
import { GamificationService, PlatformXpAction } from '../gamification/gamification.service';

const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const REFERRAL_CODE_LENGTH = 8;
/** Mirrors PLATFORM_XP_CONFIG[REFERRAL_SUCCESS].xp in gamification.service.ts — for the stats display estimate only. */
const REFERRAL_XP_REWARD = 100;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_CODE_CHARS[Math.floor(Math.random() * REFERRAL_CODE_CHARS.length)];
  }
  return code;
}

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    @InjectRepository(UserReferralCode)
    private readonly codeRepository: Repository<UserReferralCode>,
    @InjectRepository(UserReferral)
    private readonly referralRepository: Repository<UserReferral>,
    private readonly gamificationService: GamificationService,
  ) {}

  /** Get or create the user's unique referral code. */
  async getOrCreateCode(userId: string): Promise<string> {
    const existing = await this.codeRepository.findOne({ where: { userId } });
    if (existing) return existing.code;

    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const taken = await this.codeRepository.findOne({ where: { code } });
      if (!taken) break;
      code = generateCode();
      attempts++;
    }

    await this.codeRepository.save(this.codeRepository.create({ userId, code }));
    return code;
  }

  /**
   * Record that a new user signed up via a referral code.
   * Safe to call with undefined/empty code (no-op).
   */
  async claimReferral(referralCode: string | undefined, newUserId: string): Promise<void> {
    if (!referralCode?.trim()) return;

    const codeRow = await this.codeRepository.findOne({
      where: { code: referralCode.trim() },
    });
    if (!codeRow) return;
    if (codeRow.userId === newUserId) return; // can't refer yourself

    const alreadyReferred = await this.referralRepository.findOne({
      where: { referredUserId: newUserId },
    });
    if (alreadyReferred) return;

    await this.referralRepository.save(
      this.referralRepository.create({
        referrerId: codeRow.userId,
        referredUserId: newUserId,
        referralCode: referralCode.trim(),
        status: ReferralStatus.PENDING,
        rewardGranted: false,
      }),
    );
  }

  /**
   * Mark a referral as completed and grant XP reward to referrer.
   * Call when the referred user completes a qualifying action (e.g., first subscription).
   */
  async grantReward(referredUserId: string): Promise<{ rewarded: boolean; referrerId: string | null }> {
    const referral = await this.referralRepository.findOne({
      where: { referredUserId, rewardGranted: false },
    });
    if (!referral) return { rewarded: false, referrerId: null };

    referral.status = ReferralStatus.COMPLETED;
    referral.rewardGranted = true;
    await this.referralRepository.save(referral);

    if (!isSkillEconomyLmsEnabled()) {
      return { rewarded: true, referrerId: referral.referrerId };
    }

    try {
      await this.gamificationService.awardPlatformXp(
        referral.referrerId,
        PlatformXpAction.REFERRAL_SUCCESS,
      );
    } catch (err) {
      this.logger.warn(
        `Referral XP grant failed for referrer ${referral.referrerId}: ${err instanceof Error ? err.message : err}`,
      );
    }

    // Unlock referral achievement for first successful referral
    try {
      await this.gamificationService.unlockAchievement(referral.referrerId, 'first_referral');
    } catch {}

    return { rewarded: true, referrerId: referral.referrerId };
  }

  /** Stats and code for the authenticated user. */
  async getStats(userId: string): Promise<{
    code: string;
    referralUrl: string;
    totalReferrals: number;
    completedReferrals: number;
    pendingReferrals: number;
    totalXpEarned: number;
    isAmbassador: boolean;
  }> {
    const code = await this.getOrCreateCode(userId);
    const referrals = await this.referralRepository.find({ where: { referrerId: userId } });

    const completed = referrals.filter((r) => r.status === ReferralStatus.COMPLETED);
    const pending = referrals.filter((r) => r.status === ReferralStatus.PENDING);
    const isAmbassador = completed.length >= AMBASSADOR_THRESHOLD;

    return {
      code,
      referralUrl: `https://forge.app/join?ref=${code}`,
      totalReferrals: referrals.length,
      completedReferrals: completed.length,
      pendingReferrals: pending.length,
      totalXpEarned: completed.filter((r) => r.rewardGranted).length * REFERRAL_XP_REWARD,
      isAmbassador,
    };
  }

  /**
   * Ambassador leaderboard: top referrers by completed referrals.
   * Ambassador status: 10+ completed referrals.
   */
  async getAmbassadorLeaderboard(limit = 20): Promise<Array<{
    userId: string;
    completedReferrals: number;
    isAmbassador: boolean;
  }>> {
    const rows = await this.referralRepository
      .createQueryBuilder('r')
      .select('r.referrer_id', 'userId')
      .addSelect('COUNT(*)', 'completed')
      .where('r.status = :status', { status: ReferralStatus.COMPLETED })
      .groupBy('r.referrer_id')
      .orderBy('completed', 'DESC')
      .limit(limit)
      .getRawMany<{ userId: string; completed: string }>();

    return rows.map((r) => ({
      userId: r.userId,
      completedReferrals: Number(r.completed),
      isAmbassador: Number(r.completed) >= AMBASSADOR_THRESHOLD,
    }));
  }
}

const AMBASSADOR_THRESHOLD = 10;
