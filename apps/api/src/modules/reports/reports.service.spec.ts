import { BadRequestException, ForbiddenException, HttpException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { ReportsService } from './reports.service';
import { Report, ReportStatus, ReportTargetType } from './entities/report.entity';
import { Video } from '../content/entities/video.entity';
import { User } from '../users/entities/user.entity';
import { Comment } from '../engagement/entities/comment.entity';
import { ReportReason, ReportSeverity } from '@forge/shared-types';
import { LOW_TRUST_DAILY_REPORT_CAP } from './reporter-trust.util';

describe('ReportsService', () => {
  let service: ReportsService;

  const reportRepository = {
    create: jest.fn((dto: Partial<Report>) => dto),
    save: jest.fn(async (dto: Partial<Report>) => ({ id: 'report-1', ...dto })),
    findOne: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
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

    it('rejects video copyright reports and directs to the DMCA notice flow', async () => {
      videoRepository.findOne.mockResolvedValue({ id: 'v1', userId: otherUserId } as Video);
      await expect(
        service.create(reporterId, {
          targetType: 'video',
          targetId: 'v1',
          reason: 'Copyright infringement',
          reasonCategory: ReportReason.COPYRIGHT_INFRINGEMENT,
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(reportRepository.save).not.toHaveBeenCalled();
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

    it('rejects when a low-trust reporter exceeds the daily cap', async () => {
      videoRepository.findOne.mockResolvedValue({ id: 'v1', userId: otherUserId } as Video);
      reportRepository.findOne.mockResolvedValueOnce(null);
      // dismissed30d=7, upheld30d=1 → low trust cap 3; created24h=3 → reject
      reportRepository.count
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(LOW_TRUST_DAILY_REPORT_CAP);

      await expect(
        service.create(reporterId, {
          targetType: 'video',
          targetId: 'v1',
          reason: 'spam',
        }),
      ).rejects.toBeInstanceOf(HttpException);
      expect(reportRepository.save).not.toHaveBeenCalled();
    });

    it('demotes non-P0 severity for low-trust reporters', async () => {
      videoRepository.findOne.mockResolvedValue({ id: 'v1', userId: otherUserId } as Video);
      reportRepository.findOne.mockResolvedValueOnce(null);
      reportRepository.count
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      await service.create(reporterId, {
        targetType: 'video',
        targetId: 'v1',
        reason: 'Hate speech',
        reasonCategory: ReportReason.HATE_SPEECH_OR_HARASSMENT,
      });

      expect(reportRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: ReportSeverity.P2, // P1 demoted
        }),
      );
    });

    it('keeps P0 severity for low-trust reporters', async () => {
      videoRepository.findOne.mockResolvedValue({ id: 'v1', userId: otherUserId } as Video);
      reportRepository.findOne.mockResolvedValueOnce(null);
      reportRepository.count
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      await service.create(reporterId, {
        targetType: 'video',
        targetId: 'v1',
        reason: 'Child abuse',
        reasonCategory: ReportReason.CHILD_ABUSE,
      });

      expect(reportRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: ReportSeverity.P0,
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

    it('filters by severity when provided', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      reportRepository.createQueryBuilder.mockReturnValue(qb);

      await service.listForAdmin(1, 20, undefined, ReportSeverity.P0);

      expect(qb.andWhere).toHaveBeenCalledWith('r.severity = :severity', {
        severity: ReportSeverity.P0,
      });
    });

    it('filters by targetType when provided', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      reportRepository.createQueryBuilder.mockReturnValue(qb);

      await service.listForAdmin(1, 20, undefined, undefined, ReportTargetType.COMMENT);

      expect(qb.andWhere).toHaveBeenCalledWith('r.targetType = :targetType', {
        targetType: ReportTargetType.COMMENT,
      });
    });
  });

  describe('findById', () => {
    it('throws when report is missing', async () => {
      reportRepository.findOne.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns report with reporter relation', async () => {
      const report = { id: 'r1', targetType: ReportTargetType.VIDEO, targetId: 'v1', reporter: { id: reporterId } };
      reportRepository.findOne.mockResolvedValue(report);
      videoRepository.findOne.mockResolvedValue({
        id: 'v1',
        title: 'Clip',
        userId: otherUserId,
        moderationStatus: 'none',
      });

      const result = await service.findById('r1');
      expect(result).toMatchObject({
        id: 'r1',
        target: { kind: 'video', id: 'v1', title: 'Clip', userId: otherUserId },
      });
    });

    it('enriches comment reports with video + author context', async () => {
      const report = {
        id: 'r2',
        targetType: ReportTargetType.COMMENT,
        targetId: 'c1',
        reporter: { id: reporterId },
      };
      reportRepository.findOne.mockResolvedValue(report);
      commentRepository.findOne.mockResolvedValue({
        id: 'c1',
        videoId: 'v9',
        content: 'spam buy now',
        moderationStatus: 'none',
        deletedAt: null,
        user: { id: otherUserId, username: 'spammer', displayName: 'Spammer' },
        video: { id: 'v9', title: 'My upload' },
      });

      const result = await service.findById('r2');
      expect(result).toMatchObject({
        id: 'r2',
        target: {
          kind: 'comment',
          id: 'c1',
          videoId: 'v9',
          videoTitle: 'My upload',
          content: 'spam buy now',
          author: { username: 'spammer' },
        },
      });
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
