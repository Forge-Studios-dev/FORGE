import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { CopyrightNotice, CopyrightNoticeStatus } from './entities/copyright-notice.entity';
import {
  CopyrightCounterNotice,
  CounterNoticeStatus,
} from './entities/copyright-counter-notice.entity';
import { SubmitCopyrightNoticeDto } from './dto/submit-notice.dto';
import { SubmitCounterNoticeDto } from './dto/submit-counter-notice.dto';
import { addBusinessDays } from './business-days.util';
import { Video, VideoVisibility } from '../content/entities/video.entity';
import { VideosService } from '../content/videos.service';
import { AccountStrikesService } from '../account-strikes/account-strikes.service';
import { StrikeType } from '../account-strikes/entities/account-strike.entity';

const COUNTER_NOTICE_WINDOW_BUSINESS_DAYS = 10;

@Injectable()
export class CopyrightService {
  private readonly logger = new Logger(CopyrightService.name);

  constructor(
    @InjectRepository(CopyrightNotice)
    private readonly noticeRepository: Repository<CopyrightNotice>,
    @InjectRepository(CopyrightCounterNotice)
    private readonly counterNoticeRepository: Repository<CopyrightCounterNotice>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly videosService: VideosService,
    private readonly accountStrikesService: AccountStrikesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * A valid DMCA notice is itself the legal trigger for takedown — unlike a
   * user report, there's no human moderation review step before disabling
   * the video (that mirrors the actual statute, not an invented policy).
   * Issues a copyright strike to the uploader per YouTube's own 3-strike
   * copyright policy.
   */
  async submitNotice(dto: SubmitCopyrightNoticeDto): Promise<CopyrightNotice> {
    const video = await this.videoRepository.findOne({ where: { id: dto.videoId } });
    if (!video) throw new NotFoundException('Video not found');

    // A video already under an open takedown (unresolved notice) doesn't
    // need — and must not get — a second strike for the same underlying
    // claim window. Without this, one unverified claimant can replay a claim
    // against one target video (5x/hour under the public throttle) and land
    // 3 strikes -> TERMINATION_RECOMMENDED inside an hour with zero human
    // review. The video stays down either way; only the strike is deduped.
    const existingOpenNotice = await this.noticeRepository.findOne({
      where: [
        { videoId: dto.videoId, status: CopyrightNoticeStatus.TAKEDOWN_ISSUED },
        { videoId: dto.videoId, status: CopyrightNoticeStatus.COUNTER_NOTICED },
      ],
    });

    const notice = await this.noticeRepository.save(
      this.noticeRepository.create({
        videoId: dto.videoId,
        claimantName: dto.claimantName,
        claimantEmail: dto.claimantEmail,
        claimantAddress: dto.claimantAddress,
        workDescription: dto.workDescription,
        infringingDescription: dto.infringingDescription,
        goodFaithStatement: dto.goodFaithStatement,
        accuracyStatement: dto.accuracyStatement,
        signature: dto.signature,
        status: CopyrightNoticeStatus.TAKEDOWN_ISSUED,
        previousVisibility: existingOpenNotice ? null : video.visibility,
      }),
    );

    if (existingOpenNotice) {
      this.logger.log(
        `Copyright notice recorded without a new strike — video=${video.id} already has an open takedown (notice=${existingOpenNotice.id})`,
      );
      this.eventEmitter.emit('copyright.notice_recorded', {
        videoId: video.id,
        userId: video.userId,
        noticeId: notice.id,
        duplicate: true,
      });
      return notice;
    }

    await this.videoRepository.update(video.id, { visibility: VideoVisibility.PRIVATE });
    await this.videosService.bustVideoDetailCache(video.id);

    await this.accountStrikesService.issueStrike(
      video.userId,
      StrikeType.COPYRIGHT,
      `DMCA takedown: ${dto.workDescription.slice(0, 200)}`,
      // sourceReportId doubles as "which notice caused this strike" so an
      // unrebutted counter-notice reinstatement (runDueReinstatements) can
      // find and rescind the right strike later — see rescindStrike below.
      { sourceVideoId: video.id, sourceReportId: notice.id },
    );

    this.logger.log(`Copyright takedown issued: video=${video.id} notice=${notice.id}`);
    this.eventEmitter.emit('copyright.takedown_issued', {
      videoId: video.id,
      userId: video.userId,
      noticeId: notice.id,
    });

    return notice;
  }

  /** Only the uploader whose video was taken down may file a counter-notice. */
  async submitCounterNotice(
    noticeId: string,
    uploaderId: string,
    dto: SubmitCounterNoticeDto,
  ): Promise<CopyrightCounterNotice> {
    const notice = await this.noticeRepository.findOne({ where: { id: noticeId } });
    if (!notice) throw new NotFoundException('Notice not found');
    if (notice.status !== CopyrightNoticeStatus.TAKEDOWN_ISSUED) {
      throw new BadRequestException('This notice is not awaiting a counter-notice');
    }

    const video = await this.videoRepository.findOne({ where: { id: notice.videoId } });
    if (!video || video.userId !== uploaderId) {
      throw new ForbiddenException('Only the uploader may file a counter-notice for this video');
    }

    const reinstateEligibleAt = addBusinessDays(new Date(), COUNTER_NOTICE_WINDOW_BUSINESS_DAYS);

    const counterNotice = await this.counterNoticeRepository.save(
      this.counterNoticeRepository.create({
        noticeId,
        uploaderUserId: uploaderId,
        contactInfo: dto.contactInfo,
        goodFaithMistakeStatement: dto.goodFaithMistakeStatement,
        consentToJurisdiction: dto.consentToJurisdiction,
        signature: dto.signature,
        status: CounterNoticeStatus.PENDING,
        reinstateEligibleAt,
      }),
    );

    await this.noticeRepository.update(noticeId, { status: CopyrightNoticeStatus.COUNTER_NOTICED });

    this.logger.log(
      `Counter-notice filed: notice=${noticeId} reinstateEligibleAt=${reinstateEligibleAt.toISOString()}`,
    );
    this.eventEmitter.emit('copyright.counter_notice_filed', {
      noticeId,
      videoId: notice.videoId,
      userId: uploaderId,
      reinstateEligibleAt,
    });

    return counterNotice;
  }

  /**
   * Admin-only escape hatch for when a claimant reports litigation — blocks
   * the auto-reinstatement this counter-notice would otherwise get.
   */
  async rejectCounterNotice(counterNoticeId: string): Promise<{ ok: true }> {
    const counterNotice = await this.counterNoticeRepository.findOne({
      where: { id: counterNoticeId },
    });
    if (!counterNotice) throw new NotFoundException('Counter-notice not found');
    if (counterNotice.status !== CounterNoticeStatus.PENDING) {
      throw new BadRequestException('Counter-notice is not pending');
    }
    counterNotice.status = CounterNoticeStatus.REJECTED;
    counterNotice.resolvedAt = new Date();
    await this.counterNoticeRepository.save(counterNotice);
    return { ok: true };
  }

  /** Admin cross-video browse of DMCA notices. */
  async listNotices(options: { page?: number; limit?: number; status?: CopyrightNoticeStatus }) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));

    const query = this.noticeRepository
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.video', 'video')
      .orderBy('n.createdAt', 'DESC');
    if (options.status) query.andWhere('n.status = :status', { status: options.status });

    const [rows, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Admin cross-video browse of DMCA counter-notices — defaults callers toward the pending/reject-eligible queue. */
  async listCounterNotices(options: { page?: number; limit?: number; status?: CounterNoticeStatus }) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));

    const query = this.counterNoticeRepository
      .createQueryBuilder('cn')
      .leftJoinAndSelect('cn.notice', 'notice')
      .leftJoinAndSelect('cn.uploader', 'uploader')
      .orderBy('cn.createdAt', 'DESC');
    if (options.status) query.andWhere('cn.status = :status', { status: options.status });

    const [rows, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Runs on a schedule (see copyright.scheduler.ts) — reinstates videos whose counter-notice window has passed unchallenged. */
  async runDueReinstatements(): Promise<{ reinstated: number }> {
    const now = new Date();
    const due = await this.counterNoticeRepository.find({
      where: { status: CounterNoticeStatus.PENDING, reinstateEligibleAt: LessThanOrEqual(now) },
      take: 500,
    });
    if (!due.length) return { reinstated: 0 };

    const notices = await this.noticeRepository.find({
      where: { id: In(due.map((c) => c.noticeId)) },
    });
    const noticeById = new Map(notices.map((n) => [n.id, n]));

    for (const counterNotice of due) {
      const notice = noticeById.get(counterNotice.noticeId);
      if (!notice) continue;

      await this.videoRepository.update(notice.videoId, {
        visibility: (notice.previousVisibility as VideoVisibility) ?? VideoVisibility.PUBLIC,
      });
      await this.videosService.bustVideoDetailCache(notice.videoId);

      await this.noticeRepository.update(notice.id, {
        status: CopyrightNoticeStatus.REINSTATED,
        resolvedAt: now,
      });
      counterNotice.status = CounterNoticeStatus.REINSTATED;
      counterNotice.resolvedAt = now;
      await this.counterNoticeRepository.save(counterNotice);

      // The claim that caused the strike was itself just reversed — an
      // unrebutted counter-notice is a real win for the uploader, not just a
      // "content restored" outcome. Without this, the strike would keep
      // counting toward the 3-strike termination ladder with no automatic
      // remediation (docs/COPYRIGHT_DMCA.md's appeals section only covers
      // the separate, user-initiated strike-appeal path).
      const strike = await this.accountStrikesService.findActiveBySource(notice.id);
      if (strike) {
        await this.accountStrikesService.rescindStrike(
          strike.id,
          `Unrebutted counter-notice reinstated video ${notice.videoId}`,
        );
      }

      this.eventEmitter.emit('copyright.video_reinstated', {
        videoId: notice.videoId,
        userId: counterNotice.uploaderUserId,
        noticeId: notice.id,
      });
    }

    this.logger.log(`Copyright reinstatement scan: reinstated ${due.length} video(s)`);
    return { reinstated: due.length };
  }
}
