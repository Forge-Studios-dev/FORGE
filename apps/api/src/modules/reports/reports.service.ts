import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { Report, ReportStatus, ReportTargetType } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { Video } from '../content/entities/video.entity';
import { User } from '../users/entities/user.entity';
import { Comment } from '../engagement/entities/comment.entity';
import { clampLimit, clampPage } from '../../common/utils/pagination.util';
import { ReportReason, ReportSeverity, severityForReportReason } from '@forge/shared-types';
import {
  demoteSeverityForLowTrust,
  dailyReportCapForTrust,
  isLowTrustReporter,
  REPORTER_TRUST_WINDOW_MS,
} from './reporter-trust.util';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
  ) {}

  /**
   * Trust-weighted daily cap: chronically dismissed reporters get a lower
   * ceiling than the per-minute @Throttle (MVP-3 / PLATFORM_AUDIT).
   */
  private async assertReporterWithinTrustCap(reporterId: string): Promise<{
    lowTrust: boolean;
  }> {
    const since30d = new Date(Date.now() - REPORTER_TRUST_WINDOW_MS);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [dismissed30d, upheld30d, created24h] = await Promise.all([
      this.reportRepository.count({
        where: {
          reporterId,
          status: ReportStatus.DISMISSED,
          reviewedAt: MoreThan(since30d),
        },
      }),
      this.reportRepository.count({
        where: {
          reporterId,
          status: ReportStatus.REVIEWED,
          reviewedAt: MoreThan(since30d),
        },
      }),
      this.reportRepository.count({
        where: {
          reporterId,
          createdAt: MoreThan(since24h),
        },
      }),
    ]);

    const cap = dailyReportCapForTrust(dismissed30d, upheld30d);
    if (created24h >= cap) {
      throw new HttpException(
        'Report limit reached for today. Try again tomorrow.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return { lowTrust: isLowTrustReporter(dismissed30d, upheld30d) };
  }

  async create(reporterId: string, dto: CreateReportDto) {
    if (dto.targetType === 'video') {
      const video = await this.videoRepository.findOne({ where: { id: dto.targetId } });
      if (!video) throw new NotFoundException('Video not found');
      if (video.userId === reporterId) {
        throw new ForbiddenException('Cannot report your own video');
      }
    } else if (dto.targetType === 'comment') {
      const comment = await this.commentRepository.findOne({ where: { id: dto.targetId } });
      if (!comment) throw new NotFoundException('Comment not found');
      if (comment.userId === reporterId) {
        throw new ForbiddenException('Cannot report your own comment');
      }
    } else {
      const user = await this.userRepository.findOne({ where: { id: dto.targetId } });
      if (!user) throw new NotFoundException('User not found');
      if (user.id === reporterId) {
        throw new ForbiddenException('Cannot report yourself');
      }
    }

    // Video copyright claims belong in the DMCA notice pipeline — a generic
    // report would not trigger takedown and misleads rights holders.
    if (
      dto.targetType === 'video' &&
      dto.reasonCategory === ReportReason.COPYRIGHT_INFRINGEMENT
    ) {
      throw new UnprocessableEntityException({
        message:
          'Copyright claims must be filed as a DMCA notice, not a content report.',
        code: 'COPYRIGHT_USE_DMCA_NOTICE',
        noticePath: `/copyright/notice?videoId=${dto.targetId}`,
      });
    }

    const targetTypeMap: Record<CreateReportDto['targetType'], ReportTargetType> = {
      video: ReportTargetType.VIDEO,
      user: ReportTargetType.USER,
      comment: ReportTargetType.COMMENT,
    };

    // Same reporter re-reporting the same target while their prior report is
    // still pending doesn't add triage signal (severity is reason-driven, not
    // volume-driven) -- it just lets one user pad the admin queue with
    // duplicates of their own complaint.
    const duplicatePending = await this.reportRepository.findOne({
      where: {
        reporterId,
        targetType: targetTypeMap[dto.targetType],
        targetId: dto.targetId,
        status: ReportStatus.PENDING,
      },
    });
    if (duplicatePending) {
      throw new BadRequestException('You already have a pending report for this content');
    }

    const { lowTrust } = await this.assertReporterWithinTrustCap(reporterId);

    let severity = severityForReportReason(dto.reasonCategory ?? '');
    if (lowTrust) {
      severity = demoteSeverityForLowTrust(severity);
    }

    const report = this.reportRepository.create({
      reporterId,
      targetType: targetTypeMap[dto.targetType],
      targetId: dto.targetId,
      reason: dto.reason,
      reasonCategory: dto.reasonCategory ?? null,
      severity,
      status: ReportStatus.PENDING,
    });
    return this.reportRepository.save(report);
  }

  async listForAdmin(
    page = 1,
    limit = 20,
    status?: ReportStatus,
    severity?: ReportSeverity,
    targetType?: ReportTargetType,
  ) {
    page = clampPage(page);
    limit = clampLimit(limit);
    const qb = this.reportRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.reporter', 'reporter')
      // Severity-first triage (P0 before P3), newest first within a tier.
      .orderBy(
        `CASE r.severity WHEN 'p0' THEN 0 WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END`,
        'ASC',
      )
      .addOrderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (status) qb.andWhere('r.status = :status', { status });
    if (severity) qb.andWhere('r.severity = :severity', { severity });
    if (targetType) qb.andWhere('r.targetType = :targetType', { targetType });
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string) {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['reporter'],
    });
    if (!report) throw new NotFoundException('Report not found');

    if (report.targetType === ReportTargetType.COMMENT) {
      const comment = await this.commentRepository.findOne({
        where: { id: report.targetId },
        relations: ['user', 'video'],
      });
      return {
        ...report,
        target: comment
          ? {
              kind: 'comment' as const,
              id: comment.id,
              videoId: comment.videoId,
              videoTitle: comment.video?.title ?? null,
              content: comment.deletedAt ? '[deleted]' : comment.content,
              moderationStatus: comment.moderationStatus,
              deletedAt: comment.deletedAt,
              author: comment.user
                ? {
                    id: comment.user.id,
                    username: comment.user.username,
                    displayName: comment.user.displayName,
                  }
                : null,
            }
          : null,
      };
    }

    if (report.targetType === ReportTargetType.VIDEO) {
      const video = await this.videoRepository.findOne({
        where: { id: report.targetId },
        select: { id: true, title: true, userId: true, moderationStatus: true },
      });
      return {
        ...report,
        target: video
          ? {
              kind: 'video' as const,
              id: video.id,
              title: video.title,
              userId: video.userId,
              moderationStatus: video.moderationStatus,
            }
          : null,
      };
    }

    if (report.targetType === ReportTargetType.USER) {
      const user = await this.userRepository.findOne({
        where: { id: report.targetId },
        select: { id: true, username: true, displayName: true, email: true },
      });
      return {
        ...report,
        target: user
          ? {
              kind: 'user' as const,
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              email: user.email,
            }
          : null,
      };
    }

    return report;
  }

  async updateStatus(id: string, status: ReportStatus) {
    await this.reportRepository.update(id, {
      status,
      reviewedAt: new Date(),
    });
    return { ok: true };
  }

  async bulkUpdateStatus(ids: string[], status: ReportStatus) {
    if (ids.length === 0) return { ok: true, updated: 0 };
    await this.reportRepository.update({ id: In(ids) }, { status, reviewedAt: new Date() });
    return { ok: true, updated: ids.length };
  }
}
