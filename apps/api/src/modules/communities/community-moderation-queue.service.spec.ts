import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { CommunityModerationQueueService } from './community-moderation-queue.service';
import { COMMUNITY_MODERATION_QUEUE } from '../workers/community-moderation/community-moderation.constants';

describe('CommunityModerationQueueService', () => {
  let service: CommunityModerationQueueService;
  const queue = { add: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityModerationQueueService,
        { provide: getQueueToken(COMMUNITY_MODERATION_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(CommunityModerationQueueService);
  });

  it('enqueues flagged message review jobs', async () => {
    await service.enqueueFlaggedMessage({
      communityId: 'comm-1',
      channelId: 'ch-1',
      userId: 'user-1',
      messageBody: 'spam link',
      score: 0.9,
      reasons: ['spam'],
    });
    expect(queue.add).toHaveBeenCalledWith(
      'review-flagged',
      expect.objectContaining({ messageBody: 'spam link' }),
      expect.objectContaining({ removeOnComplete: expect.any(Object) }),
    );
  });
});
