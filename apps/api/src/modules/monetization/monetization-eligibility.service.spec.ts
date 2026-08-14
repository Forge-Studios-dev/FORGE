import { NotFoundException } from '@nestjs/common';
import { MonetizationEligibilityService } from './monetization-eligibility.service';
import { CreatorStatus } from '../users/entities/user.entity';

function makeQb(raw: Record<string, string>) {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(raw),
  };
}

describe('MonetizationEligibilityService', () => {
  const userRepository = { findOne: jest.fn() };
  const videoRepository = { createQueryBuilder: jest.fn() };
  const watchHistoryRepository = { createQueryBuilder: jest.fn() };

  const service = new MonetizationEligibilityService(
    userRepository as never,
    videoRepository as never,
    watchHistoryRepository as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    watchHistoryRepository.createQueryBuilder.mockReturnValue(makeQb({ totalSeconds: '0' }));
    videoRepository.createQueryBuilder.mockReturnValue(makeQb({ totalViews: '0' }));
  });

  it('throws NotFoundException for an unknown user', async () => {
    userRepository.findOne.mockResolvedValue(null);
    await expect(service.getEligibility('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('is eligible when subscribers + watch hours + approval + no restriction all clear', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'creator-1',
      followerCount: 1500,
      creatorStatus: CreatorStatus.APPROVED,
      uploadRestrictedUntil: null,
    });
    watchHistoryRepository.createQueryBuilder.mockReturnValue(
      makeQb({ totalSeconds: String(4500 * 3600) }),
    );

    const result = await service.getEligibility('creator-1');

    expect(result.eligible).toBe(true);
    expect(result.subscriberCount).toBe(1500);
    expect(result.watchHours365d).toBe(4500);
    expect(result.meetsAudienceThreshold).toBe(true);
  });

  it('is eligible via the Shorts-views alternate path even with low watch hours', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'creator-1',
      followerCount: 2000,
      creatorStatus: CreatorStatus.APPROVED,
      uploadRestrictedUntil: null,
    });
    videoRepository.createQueryBuilder.mockReturnValue(
      makeQb({ totalViews: String(12_000_000) }),
    );

    const result = await service.getEligibility('creator-1');

    expect(result.eligible).toBe(true);
    expect(result.shortsViews90d).toBe(12_000_000);
  });

  it('is not eligible below the subscriber threshold even if watch hours clear', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'creator-1',
      followerCount: 999,
      creatorStatus: CreatorStatus.APPROVED,
      uploadRestrictedUntil: null,
    });
    watchHistoryRepository.createQueryBuilder.mockReturnValue(
      makeQb({ totalSeconds: String(5000 * 3600) }),
    );

    const result = await service.getEligibility('creator-1');

    expect(result.eligible).toBe(false);
  });

  it('is not eligible with an active strike-driven upload restriction', async () => {
    const future = new Date(Date.now() + 86_400_000);
    userRepository.findOne.mockResolvedValue({
      id: 'creator-1',
      followerCount: 5000,
      creatorStatus: CreatorStatus.APPROVED,
      uploadRestrictedUntil: future,
    });
    watchHistoryRepository.createQueryBuilder.mockReturnValue(
      makeQb({ totalSeconds: String(5000 * 3600) }),
    );

    const result = await service.getEligibility('creator-1');

    expect(result.eligible).toBe(false);
    expect(result.hasActiveUploadRestriction).toBe(true);
  });

  it('is not eligible when creator status is not approved', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'creator-1',
      followerCount: 5000,
      creatorStatus: CreatorStatus.PENDING,
      uploadRestrictedUntil: null,
    });
    watchHistoryRepository.createQueryBuilder.mockReturnValue(
      makeQb({ totalSeconds: String(5000 * 3600) }),
    );

    const result = await service.getEligibility('creator-1');

    expect(result.eligible).toBe(false);
    expect(result.isApprovedCreator).toBe(false);
  });
});
