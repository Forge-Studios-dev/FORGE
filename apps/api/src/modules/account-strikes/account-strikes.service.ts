import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MoreThan, Repository } from 'typeorm';
import {
  AccountStrike,
  AppealStatus,
  StrikeConsequence,
  StrikeStatus,
  StrikeType,
} from './entities/account-strike.entity';
import { User } from '../users/entities/user.entity';

const STRIKE_WINDOW_DAYS = 90;
const UPLOAD_RESTRICTION_DAYS = 14;

@Injectable()
export class AccountStrikesService {
  private readonly logger = new Logger(AccountStrikesService.name);

  constructor(
    @InjectRepository(AccountStrike)
    private readonly strikeRepository: Repository<AccountStrike>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Records a strike and computes (but never auto-executes) its consequence
   * per YouTube's own published ladder: 1st = warning, 2nd within 90 days =
   * 2-week upload restriction (enforced here), 3rd within 90 days =
   * termination *recommended* — an admin must actually terminate an account;
   * this never does that itself (see ESCALATION_RULES.md §3: irreversible
   * account actions are admin-only).
   */
  async issueStrike(
    userId: string,
    type: StrikeType,
    reason: string,
    opts?: { sourceVideoId?: string; sourceReportId?: string },
  ): Promise<AccountStrike> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - STRIKE_WINDOW_DAYS);

    const activeCount = await this.strikeRepository.count({
      where: { userId, type, status: StrikeStatus.ACTIVE, createdAt: MoreThan(windowStart) },
    });
    const strikeNumber = activeCount + 1;
    const consequence = this.consequenceForStrikeNumber(strikeNumber);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + STRIKE_WINDOW_DAYS);

    const strike = await this.strikeRepository.save(
      this.strikeRepository.create({
        userId,
        type,
        reason,
        sourceVideoId: opts?.sourceVideoId ?? null,
        sourceReportId: opts?.sourceReportId ?? null,
        consequence,
        status: StrikeStatus.ACTIVE,
        appealStatus: AppealStatus.NONE,
        expiresAt,
      }),
    );

    if (consequence === StrikeConsequence.UPLOAD_RESTRICTION_2W) {
      const restrictedUntil = new Date();
      restrictedUntil.setDate(restrictedUntil.getDate() + UPLOAD_RESTRICTION_DAYS);
      await this.userRepository.update(userId, { uploadRestrictedUntil: restrictedUntil });
    }

    this.logger.log(
      `Strike issued: user=${userId} type=${type} #${strikeNumber} consequence=${consequence}`,
    );
    this.eventEmitter.emit('account.strike_issued', {
      userId,
      strikeId: strike.id,
      type,
      strikeNumber,
      consequence,
    });

    return strike;
  }

  private consequenceForStrikeNumber(n: number): StrikeConsequence {
    if (n >= 3) return StrikeConsequence.TERMINATION_RECOMMENDED;
    if (n === 2) return StrikeConsequence.UPLOAD_RESTRICTION_2W;
    return StrikeConsequence.WARNING;
  }

  async submitAppeal(strikeId: string, userId: string, reason: string): Promise<AccountStrike> {
    const strike = await this.strikeRepository.findOne({ where: { id: strikeId } });
    if (!strike) throw new NotFoundException('Strike not found');
    if (strike.userId !== userId) throw new ForbiddenException('Not your strike');
    if (strike.status !== StrikeStatus.ACTIVE) {
      throw new BadRequestException('Only an active strike can be appealed');
    }
    if (strike.appealStatus === AppealStatus.PENDING) {
      throw new BadRequestException('An appeal is already pending for this strike');
    }

    strike.appealStatus = AppealStatus.PENDING;
    strike.appealReason = reason;
    await this.strikeRepository.save(strike);
    this.eventEmitter.emit('account.strike_appealed', { userId, strikeId });
    return strike;
  }

  /** Admin-only — see admin.controller.ts. Granting rescinds the strike and lifts any upload restriction it caused. */
  async resolveAppeal(strikeId: string, granted: boolean): Promise<AccountStrike> {
    const strike = await this.strikeRepository.findOne({ where: { id: strikeId } });
    if (!strike) throw new NotFoundException('Strike not found');
    if (strike.appealStatus !== AppealStatus.PENDING) {
      throw new BadRequestException('No pending appeal for this strike');
    }

    strike.appealStatus = granted ? AppealStatus.GRANTED : AppealStatus.DENIED;
    if (granted) {
      strike.status = StrikeStatus.RESCINDED;
      strike.resolvedAt = new Date();
      if (strike.consequence === StrikeConsequence.UPLOAD_RESTRICTION_2W) {
        await this.userRepository.update(strike.userId, { uploadRestrictedUntil: null });
      }
    }
    await this.strikeRepository.save(strike);
    this.eventEmitter.emit('account.strike_appeal_resolved', {
      userId: strike.userId,
      strikeId,
      granted,
    });
    return strike;
  }

  async listForUser(userId: string): Promise<AccountStrike[]> {
    return this.strikeRepository.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  /** Admin cross-user browse — defaults to the appeals queue (what actually needs action). */
  async listAll(options: {
    page?: number;
    limit?: number;
    appealStatus?: AppealStatus;
    status?: StrikeStatus;
  }) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));

    const query = this.strikeRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .orderBy('s.createdAt', 'DESC');
    if (options.appealStatus) {
      query.andWhere('s.appealStatus = :appealStatus', { appealStatus: options.appealStatus });
    }
    if (options.status) {
      query.andWhere('s.status = :status', { status: options.status });
    }

    const [rows, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
