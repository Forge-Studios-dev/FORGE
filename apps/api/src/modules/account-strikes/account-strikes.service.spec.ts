import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountStrikesService } from './account-strikes.service';
import {
  AppealStatus,
  StrikeConsequence,
  StrikeStatus,
  StrikeType,
} from './entities/account-strike.entity';

describe('AccountStrikesService', () => {
  const strikeRepository = {
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: any) => ({ id: 'strike-1', ...x })),
    findOne: jest.fn(),
  };
  const userRepository = {
    findOne: jest.fn().mockResolvedValue({ id: 'user-1' }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const eventEmitter = { emit: jest.fn() };

  let service: AccountStrikesService;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository.findOne.mockResolvedValue({ id: 'user-1' });
    strikeRepository.count.mockResolvedValue(0);
    service = new AccountStrikesService(
      strikeRepository as never,
      userRepository as never,
      eventEmitter as never,
    );
  });

  describe('issueStrike', () => {
    it('issues a warning for the 1st strike', async () => {
      strikeRepository.count.mockResolvedValue(0);
      const strike = await service.issueStrike('user-1', StrikeType.COMMUNITY_GUIDELINE, 'spam');
      expect(strike.consequence).toBe(StrikeConsequence.WARNING);
      expect(strikeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ consequence: StrikeConsequence.WARNING }),
      );
      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('issues a 2-week upload restriction for the 2nd strike and restricts the user', async () => {
      strikeRepository.count.mockResolvedValue(1);
      await service.issueStrike('user-1', StrikeType.COMMUNITY_GUIDELINE, 'spam again');
      expect(strikeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ consequence: StrikeConsequence.UPLOAD_RESTRICTION_2W }),
      );
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        uploadRestrictedUntil: expect.any(Date),
      });
    });

    it('recommends termination (without executing it) for the 3rd strike', async () => {
      strikeRepository.count.mockResolvedValue(2);
      await service.issueStrike('user-1', StrikeType.COMMUNITY_GUIDELINE, 'again');
      expect(strikeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ consequence: StrikeConsequence.TERMINATION_RECOMMENDED }),
      );
      // Never touches isActive/deletedAt — termination stays an admin decision.
      expect(userRepository.update).not.toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ isActive: false }),
      );
    });

    it('only counts strikes of the same type toward the ladder', async () => {
      await service.issueStrike('user-1', StrikeType.COPYRIGHT, 'dmca');
      expect(strikeRepository.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ type: StrikeType.COPYRIGHT }) }),
      );
    });

    it('throws when the user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(
        service.issueStrike('missing', StrikeType.COMMUNITY_GUIDELINE, 'x'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('submitAppeal', () => {
    it('sets appeal to pending for the strike owner', async () => {
      strikeRepository.findOne.mockResolvedValue({
        id: 's1',
        userId: 'user-1',
        status: StrikeStatus.ACTIVE,
        appealStatus: AppealStatus.NONE,
      });
      const result = await service.submitAppeal('s1', 'user-1', 'it was a mistake, honestly');
      expect(result.appealStatus).toBe(AppealStatus.PENDING);
    });

    it('rejects appealing someone else’s strike', async () => {
      strikeRepository.findOne.mockResolvedValue({
        id: 's1',
        userId: 'other-user',
        status: StrikeStatus.ACTIVE,
        appealStatus: AppealStatus.NONE,
      });
      await expect(service.submitAppeal('s1', 'user-1', 'not mine')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects appealing a non-active strike', async () => {
      strikeRepository.findOne.mockResolvedValue({
        id: 's1',
        userId: 'user-1',
        status: StrikeStatus.RESCINDED,
        appealStatus: AppealStatus.NONE,
      });
      await expect(service.submitAppeal('s1', 'user-1', 'reason')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('resolveAppeal', () => {
    it('rescinds the strike and lifts an upload restriction when granted', async () => {
      strikeRepository.findOne.mockResolvedValue({
        id: 's1',
        userId: 'user-1',
        status: StrikeStatus.ACTIVE,
        appealStatus: AppealStatus.PENDING,
        consequence: StrikeConsequence.UPLOAD_RESTRICTION_2W,
      });
      const result = await service.resolveAppeal('s1', true);
      expect(result.status).toBe(StrikeStatus.RESCINDED);
      expect(userRepository.update).toHaveBeenCalledWith('user-1', { uploadRestrictedUntil: null });
    });

    it('marks denied without changing strike status when not granted', async () => {
      strikeRepository.findOne.mockResolvedValue({
        id: 's1',
        userId: 'user-1',
        status: StrikeStatus.ACTIVE,
        appealStatus: AppealStatus.PENDING,
        consequence: StrikeConsequence.WARNING,
      });
      const result = await service.resolveAppeal('s1', false);
      expect(result.appealStatus).toBe(AppealStatus.DENIED);
      expect(result.status).toBe(StrikeStatus.ACTIVE);
    });

    it('throws when there is no pending appeal', async () => {
      strikeRepository.findOne.mockResolvedValue({
        id: 's1',
        appealStatus: AppealStatus.NONE,
      });
      await expect(service.resolveAppeal('s1', true)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
