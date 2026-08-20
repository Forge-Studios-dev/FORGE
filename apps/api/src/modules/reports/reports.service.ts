import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Report, ReportStatus, ReportTargetType } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { Video } from '../content/entities/video.entity';
import { User } from '../users/entities/user.entity';
import { Comment } from '../engagement/entities/comment.entity';
import { clampLimit, clampPage } from '../../common/utils/pagination.util';
import { severityForReportReason } from '@forge/shared-types';

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

    const report = this.reportRepository.create({
      reporterId,
      targetType: targetTypeMap[dto.targetType],
      targetId: dto.targetId,
      reason: dto.reason,
      reasonCategory: dto.reasonCategory ?? null,
      severity: severityForReportReason(dto.reasonCategory ?? ''),
      status: ReportStatus.PENDING,
    });
    return this.reportRepository.save(report);
  }

  async listForAdmin(page = 1, limit = 20, status?: ReportStatus) {
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
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string) {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['reporter'],
    });
    if (!report) throw new NotFoundException('Report not found');
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
