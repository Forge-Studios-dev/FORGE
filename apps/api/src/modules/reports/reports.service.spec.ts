import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { ReportsService } from './reports.service';
import { Report, ReportStatus, ReportTargetType } from './entities/report.entity';
import { Video } from '../content/entities/video.entity';
import { User } from '../users/entities/user.entity';
import { Comment } from '../engagement/entities/comment.entity';
import { ReportReason, ReportSeverity } from '@forge/shared-types';

describe('ReportsService', () => {
  let service: ReportsService;

  const reportRepository = {
    create: jest.fn((dto: Partial<Report>) => dto),
    save: jest.fn(async (dto: Partial<Report>) => ({ id: 'report-1', ...dto })),
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const videoRepository = { findOne: jest.fn() };
  const userRepository = { findOne: jest.fn() };
  const commentRepository = { findOne: jest.fn() };

  const reporterId = 'reporter-1';
  const otherUserId = 'user-2';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Report), useValue: reportRepository },
        { provide: getRepositoryToken(Video), useValue: videoRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Comment), useValue: commentRepository },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  describe('create', () => {
    it('rejects reporting a missing video', async () => {
      videoRepository.findOne.mockResolvedValue(null);
      await expect(
        service.create(reporterId, {
          targetType: 'video',
          targetId: 'missing',
          reason: 'spam content',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects reporting your own video', async () => {
      videoRepository.findOne.mockResolvedValue({ id: 'v1', userId: reporterId } as Video);
      await expect(
        service.create(reporterId, {
          targetType: 'video',
          targetId: 'v1',
          reason: 'spam content',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates a pending video report', async () => {
      videoRepository.findOne.mockResolvedValue({ id: 'v1', userId: otherUserId } as Video);

      const result = await service.create(reporterId, {
        targetType: 'video',
        targetId: 'v1',
        reason: 'misleading title',
      });

      expect(reportRepository.create).toHaveBeenCalledWith({
        reporterId,
        targetType: ReportTargetType.VIDEO,
        targetId: 'v1',
        reason: 'misleading title',
        reasonCategory: null,
        severity: ReportSeverity.P3,
        status: ReportStatus.PENDING,
      });
      expect(result.id).toBe('report-1');
    });

    it('rejects a duplicate report while the reporter already has a pending one for the same target', async () => {
      videoRepository.findOne.mockResolvedValue({ id: 'v1', userId: otherUserId } as Video);
      reportRepository.findOne.mockResolvedValueOnce({ id: 'existing-report' } as Report);

      await expect(
        service.create(reporterId, {
          targetType: 'video',
          targetId: 'v1',
          reason: 'spam content',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(reportRepository.save).not.toHaveBeenCalled();
    });

    it('allows re-reporting the same target once the prior report is no longer pending', async () => {
      videoRepository.findOne.mockResolvedValue({ id: 'v1', userId: otherUserId } as Video);
      reportRepository.findOne.mockResolvedValueOnce(null);

      await service.create(reporterId, {
        targetType: 'video',
        targetId: 'v1',
        reason: 'spam content',
      });

      expect(reportRepository.save).toHaveBeenCalled();
    });

    it('derives severity from reasonCategory when the client sends one', async () => {
      videoRepository.findOne.mockResolvedValue({ id: 'v1', userId: otherUserId } as Video);

      await service.create(reporterId, {
        targetType: 'video',
        targetId: 'v1',
        reason: 'Child abuse: this depicts a minor',
        reasonCategory: ReportReason.CHILD_ABUSE,
      });

      expect(reportRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reasonCategory: ReportReason.CHILD_ABUSE,
          severity: ReportSeverity.P0,
        }),
      );
    });

    it('rejects reporting your own comment', async () => {
      commentRepository.findOne.mockResolvedValue({ id: 'c1', userId: reporterId } as Comment);
      await expect(
        service.create(reporterId, {
          targetType: 'comment',
          targetId: 'c1',
          reason: 'harassment',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects reporting yourself', async () => {
      userRepository.findOne.mockResolvedValue({ id: reporterId } as User);
      await expect(
        service.create(reporterId, {
          targetType: 'user',
          targetId: reporterId,
          reason: 'abuse',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates a pending user report', async () => {
      userRepository.findOne.mockResolvedValue({ id: otherUserId } as User);

      await service.create(reporterId, {
        targetType: 'user',
        targetId: otherUserId,
        reason: 'harassment',
      });

      expect(reportRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: ReportTargetType.USER,
          status: ReportStatus.PENDING,
        }),
      );
    });
  });

  describe('listForAdmin', () => {
    it('returns paginated admin report list', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'r1' }], 1]),
      };
      reportRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listForAdmin(1, 20, ReportStatus.PENDING);

      expect(qb.andWhere).toHaveBeenCalledWith('r.status = :status', {
        status: ReportStatus.PENDING,
      });
      expect(qb.orderBy).toHaveBeenCalledWith(expect.stringContaining('r.severity'), 'ASC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('r.createdAt', 'DESC');
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });
  });

  describe('findById', () => {
    it('throws when report is missing', async () => {
      reportRepository.findOne.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns report with reporter relation', async () => {
      const report = { id: 'r1', reporter: { id: reporterId } };
      reportRepository.findOne.mockResolvedValue(report);

      await expect(service.findById('r1')).resolves.toBe(report);
    });
  });

  describe('updateStatus', () => {
    it('marks report reviewed with timestamp', async () => {
      const result = await service.updateStatus('r1', ReportStatus.REVIEWED);

      expect(reportRepository.update).toHaveBeenCalledWith('r1', {
        status: ReportStatus.REVIEWED,
        reviewedAt: expect.any(Date),
      });
      expect(result).toEqual({ ok: true });
    });
  });

  describe('bulkUpdateStatus', () => {
    it('updates all ids in a single call', async () => {
      const result = await service.bulkUpdateStatus(['r1', 'r2', 'r3'], ReportStatus.DISMISSED);

      expect(reportRepository.update).toHaveBeenCalledTimes(1);
      expect(reportRepository.update).toHaveBeenCalledWith(
        { id: In(['r1', 'r2', 'r3']) },
        { status: ReportStatus.DISMISSED, reviewedAt: expect.any(Date) },
      );
      expect(result).toEqual({ ok: true, updated: 3 });
    });

    it('no-ops on an empty id list', async () => {
      const result = await service.bulkUpdateStatus([], ReportStatus.DISMISSED);
      expect(reportRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: true, updated: 0 });
    });
  });
});
