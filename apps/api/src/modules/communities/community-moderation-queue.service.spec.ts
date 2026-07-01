import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { CommunityModerationQueueService } from './community-moderation-queue.service';
import { AiCommunityService } from './ai-community.service';
import { COMMUNITY_MODERATION_QUEUE } from '../workers/community-moderation/community-moderation.constants';

describe('CommunityModerationQueueService', () => {
  let service: CommunityModerationQueueService;
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const aiCommunityService = {
    scoreContentAsync: jest
      .fn()
      .mockResolvedValue({ flagged: false, score: 0, reasons: [], model: 'regex' }),
  };
  const configValues: Record<string, unknown> = {};
  const configService = { get: jest.fn((key: string) => configValues[key]) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityModerationQueueService,
        { provide: getQueueToken(COMMUNITY_MODERATION_QUEUE), useValue: queue },
        { provide: AiCommunityService, useValue: aiCommunityService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    service = module.get(CommunityModerationQueueService);
  });

  afterEach(() => {
    for (const k of Object.keys(configValues)) delete configValues[k];
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

  it('skips the LLM tail when moderation LLM is disabled', async () => {
    service.maybeQueueLlmTail({
      communityId: 'comm-1',
      surface: 'post_comment',
      surfaceId: 'post-1',
      userId: 'user-1',
      messageId: 'cmt-1',
      body: 'borderline',
      fastPathScore: 0.4,
    });
    await new Promise((r) => setImmediate(r));
    expect(aiCommunityService.scoreContentAsync).not.toHaveBeenCalled();
  });

  it('skips the LLM tail below the review threshold (cost guard)', async () => {
    configValues['ai.moderationLlmEnabled'] = true;
    configValues['openai.apiKey'] = 'sk-test';
    configValues['ai.moderationReviewThreshold'] = 0.25;
    service.maybeQueueLlmTail({
      communityId: 'comm-1',
      surface: 'room',
      surfaceId: 'room-1',
      userId: 'user-1',
      messageId: 'msg-1',
      body: 'clearly fine',
      fastPathScore: 0.1,
    });
    await new Promise((r) => setImmediate(r));
    expect(aiCommunityService.scoreContentAsync).not.toHaveBeenCalled();
  });

  it('enqueues an llm_tail job with surface metadata when the judge flags content', async () => {
    configValues['ai.moderationLlmEnabled'] = true;
    configValues['openai.apiKey'] = 'sk-test';
    configValues['ai.moderationReviewThreshold'] = 0.25;
    aiCommunityService.scoreContentAsync.mockResolvedValue({
      flagged: true,
      score: 0.82,
      reasons: ['openai_moderation'],
      model: 'llm',
    });
    service.maybeQueueLlmTail({
      communityId: 'comm-1',
      surface: 'post_comment',
      surfaceId: 'post-1',
      userId: 'user-1',
      messageId: 'cmt-1',
      body: 'borderline content the llm flags',
      fastPathScore: 0.4,
    });
    await new Promise((r) => setImmediate(r));
    expect(queue.add).toHaveBeenCalledWith(
      'review-flagged',
      expect.objectContaining({
        detectedBy: 'llm_tail',
        surface: 'post_comment',
        channelId: 'post-1',
        messageId: 'cmt-1',
        score: 0.82,
      }),
      expect.any(Object),
    );
  });

  it('does not enqueue when the LLM tail clears borderline content', async () => {
    configValues['ai.moderationLlmEnabled'] = true;
    configValues['openai.apiKey'] = 'sk-test';
    configValues['ai.moderationReviewThreshold'] = 0.25;
    aiCommunityService.scoreContentAsync.mockResolvedValue({
      flagged: false,
      score: 0.1,
      reasons: [],
      model: 'llm',
    });
    service.maybeQueueLlmTail({
      communityId: 'comm-1',
      surface: 'room',
      surfaceId: 'room-1',
      userId: 'user-1',
      messageId: 'msg-1',
      body: 'borderline but actually fine',
      fastPathScore: 0.4,
    });
    await new Promise((r) => setImmediate(r));
    expect(aiCommunityService.scoreContentAsync).toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});
