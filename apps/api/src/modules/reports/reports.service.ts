import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportStatus, ReportTargetType } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { Video } from '../content/entities/video.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(reporterId: string, dto: CreateReportDto) {
    if (dto.targetType === 'video') {
      const video = await this.videoRepository.findOne({ where: { id: dto.targetId } });
      if (!video) throw new NotFoundException('Video not found');
      if (video.userId === reporterId) {
        throw new ForbiddenException('Cannot report your own video');
      }
    } else {
      const user = await this.userRepository.findOne({ where: { id: dto.targetId } });
      if (!user) throw new NotFoundException('User not found');
      if (user.id === reporterId) {
        throw new ForbiddenException('Cannot report yourself');
      }
    }

    const report = this.reportRepository.create({
      reporterId,
      targetType: dto.targetType === 'video' ? ReportTargetType.VIDEO : ReportTargetType.USER,
      targetId: dto.targetId,
      reason: dto.reason,
      status: ReportStatus.PENDING,
    });
    return this.reportRepository.save(report);
  }

  async listForAdmin(page = 1, limit = 20, status?: ReportStatus) {
    const qb = this.reportRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.reporter', 'reporter')
      .orderBy('r.createdAt', 'DESC')
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
}
