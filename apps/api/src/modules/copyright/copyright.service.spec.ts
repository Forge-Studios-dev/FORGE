import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CopyrightService } from './copyright.service';
import { CopyrightNoticeStatus } from './entities/copyright-notice.entity';
import { CounterNoticeStatus } from './entities/copyright-counter-notice.entity';
import { VideoVisibility } from '../content/entities/video.entity';
import { StrikeType } from '../account-strikes/entities/account-strike.entity';

describe('CopyrightService', () => {
  const noticeRepository = {
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: any) => ({ id: 'notice-1', ...x })),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const counterNoticeRepository = {
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: any) => ({ id: 'counter-1', ...x })),
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const videoRepository = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const videosService = { bustVideoDetailCache: jest.fn().mockResolvedValue(undefined) };
  const accountStrikesService = { issueStrike: jest.fn().mockResolvedValue({ id: 'strike-1' }) };
  const eventEmitter = { emit: jest.fn() };

  const noticeDto = {
    videoId: 'v1',
    claimantName: 'Jane Claimant',
    claimantEmail: 'jane@example.com',
    claimantAddress: '123 Main St, Springfield',
    workDescription: 'My original short film "Sunset Over the Lake"',
    infringingDescription: 'The full video at /watch/v1 reuses my footage without permission',
    goodFaithStatement: true,
    accuracyStatement: true,
    signature: 'Jane Claimant',
  };

  let service: CopyrightService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CopyrightService(
      noticeRepository as never,
      counterNoticeRepository as never,
      videoRepository as never,
      videosService as never,
      accountStrikesService as never,
      eventEmitter as never,
    );
  });

  describe('submitNotice', () => {
    it('disables the video, records previous visibility, and issues a copyright strike', async () => {
      videoRepository.findOne.mockResolvedValue({
        id: 'v1',
        userId: 'uploader-1',
        visibility: VideoVisibility.PUBLIC,
      });

      const notice = await service.submitNotice(noticeDto);

      expect(videoRepository.update).toHaveBeenCalledWith('v1', {
        visibility: VideoVisibility.PRIVATE,
      });
      expect(noticeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: CopyrightNoticeStatus.TAKEDOWN_ISSUED,
          previousVisibility: VideoVisibility.PUBLIC,
        }),
      );
      expect(accountStrikesService.issueStrike).toHaveBeenCalledWith(
        'uploader-1',
        StrikeType.COPYRIGHT,
        expect.stringContaining('DMCA takedown'),
        { sourceVideoId: 'v1' },
      );
      expect(notice.id).toBe('notice-1');
    });

    it('throws when the video does not exist', async () => {
      videoRepository.findOne.mockResolvedValue(null);
      await expect(service.submitNotice(noticeDto)).rejects.toBeInstanceOf(NotFoundException);
      expect(accountStrikesService.issueStrike).not.toHaveBeenCalled();
    });
  });

  describe('submitCounterNotice', () => {
    const counterDto = {
      contactInfo: '456 Oak Ave, Springfield, uploader@example.com',
      goodFaithMistakeStatement: true,
      consentToJurisdiction: true,
      signature: 'Uploader Name',
    };

    it('files a counter-notice with a 10-business-day reinstatement window', async () => {
      noticeRepository.findOne.mockResolvedValue({
        id: 'notice-1',
        videoId: 'v1',
        status: CopyrightNoticeStatus.TAKEDOWN_ISSUED,
      });
      videoRepository.findOne.mockResolvedValue({ id: 'v1', userId: 'uploader-1' });

      const result = await service.submitCounterNotice('notice-1', 'uploader-1', counterDto);

      expect(result.reinstateEligibleAt).toBeInstanceOf(Date);
      expect(noticeRepository.update).toHaveBeenCalledWith('notice-1', {
        status: CopyrightNoticeStatus.COUNTER_NOTICED,
      });
    });

    it('rejects a counter-notice from someone other than the uploader', async () => {
      noticeRepository.findOne.mockResolvedValue({
        id: 'notice-1',
        videoId: 'v1',
        status: CopyrightNoticeStatus.TAKEDOWN_ISSUED,
      });
      videoRepository.findOne.mockResolvedValue({ id: 'v1', userId: 'uploader-1' });

      await expect(
        service.submitCounterNotice('notice-1', 'someone-else', counterDto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects filing a counter-notice on a notice that is not awaiting one', async () => {
      noticeRepository.findOne.mockResolvedValue({
        id: 'notice-1',
        videoId: 'v1',
        status: CopyrightNoticeStatus.REINSTATED,
      });
      await expect(
        service.submitCounterNotice('notice-1', 'uploader-1', counterDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('rejectCounterNotice', () => {
    it('marks a pending counter-notice rejected', async () => {
      counterNoticeRepository.findOne.mockResolvedValue({
        id: 'counter-1',
        status: CounterNoticeStatus.PENDING,
      });
      const result = await service.rejectCounterNotice('counter-1');
      expect(result).toEqual({ ok: true });
      expect(counterNoticeRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: CounterNoticeStatus.REJECTED }),
      );
    });

    it('throws when the counter-notice is not pending', async () => {
      counterNoticeRepository.findOne.mockResolvedValue({
        id: 'counter-1',
        status: CounterNoticeStatus.REINSTATED,
      });
      await expect(service.rejectCounterNotice('counter-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('runDueReinstatements', () => {
    it('restores the video to its previous visibility and marks both records reinstated', async () => {
      counterNoticeRepository.find.mockResolvedValue([
        { id: 'counter-1', noticeId: 'notice-1', uploaderUserId: 'uploader-1', status: CounterNoticeStatus.PENDING },
      ]);
      noticeRepository.findOne.mockResolvedValue({
        id: 'notice-1',
        videoId: 'v1',
        previousVisibility: VideoVisibility.UNLISTED,
      });

      const result = await service.runDueReinstatements();

      expect(result).toEqual({ reinstated: 1 });
      expect(videoRepository.update).toHaveBeenCalledWith('v1', {
        visibility: VideoVisibility.UNLISTED,
      });
      expect(noticeRepository.update).toHaveBeenCalledWith('notice-1', {
        status: CopyrightNoticeStatus.REINSTATED,
        resolvedAt: expect.any(Date),
      });
      expect(counterNoticeRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: CounterNoticeStatus.REINSTATED }),
      );
    });

    it('does nothing when none are due', async () => {
      counterNoticeRepository.find.mockResolvedValue([]);
      const result = await service.runDueReinstatements();
      expect(result).toEqual({ reinstated: 0 });
      expect(videoRepository.update).not.toHaveBeenCalled();
    });
  });
});
