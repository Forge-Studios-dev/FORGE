import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { CommunityModerationQueueService } from './community-moderation-queue.service';
import { AiCommunityService } from './ai-community.service';
import { COMMUNITY_MODERATION_QUEUE } from '../workers/community-moderation/community-moderation.constants';

describe('CommunityModerationQueueService', () => {
  let service: CommunityModerationQueueService;
  const queue = {
    add: jest.fn().mockResolvedValue(undefined),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 3,
      active: 1,
      completed: 10,
      failed: 2,
      delayed: 0,
    }),
  };
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

  it('returns queue job counts with zero defaults', async () => {
    const counts = await service.getQueueCounts();
    expect(queue.getJobCounts).toHaveBeenCalledWith(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    );
    expect(counts).toEqual({
      waiting: 3,
      active: 1,
      completed: 10,
      failed: 2,
      delayed: 0,
    });
  });

  it('defaults missing job count fields to zero', async () => {
    queue.getJobCounts.mockResolvedValueOnce({});
    await expect(service.getQueueCounts()).resolves.toEqual({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    });
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

  it('queues borderline content for manual review when the LLM never actually delivered a verdict (budget/API failure), instead of silently approving it', async () => {
    configValues['ai.moderationLlmEnabled'] = true;
    configValues['openai.apiKey'] = 'sk-test';
    configValues['ai.moderationReviewThreshold'] = 0.25;
    // model: 'regex' with flagged: false here means the config gate passed
    // (LLM enabled+configured) but the async cascade fell back to baseline —
    // i.e. the OpenAI call itself failed/budget-skipped, not "not configured".
    aiCommunityService.scoreContentAsync.mockResolvedValue({
      flagged: false,
      score: 0.4,
      reasons: [],
      model: 'regex',
    });
    service.maybeQueueLlmTail({
      communityId: 'comm-1',
      surface: 'room',
      surfaceId: 'room-1',
      userId: 'user-1',
      messageId: 'msg-1',
      body: 'borderline, AI unavailable',
      fastPathScore: 0.4,
    });
    await new Promise((r) => setImmediate(r));

    expect(queue.add).toHaveBeenCalledWith(
      'review-flagged',
      expect.objectContaining({ aiUnavailable: true, detectedBy: 'llm_tail' }),
      expect.any(Object),
    );
  });

  it('queues for manual review when the async LLM tail throws outright', async () => {
    configValues['ai.moderationLlmEnabled'] = true;
    configValues['openai.apiKey'] = 'sk-test';
    configValues['ai.moderationReviewThreshold'] = 0.25;
    aiCommunityService.scoreContentAsync.mockRejectedValue(new Error('network down'));

    service.maybeQueueLlmTail({
      communityId: 'comm-1',
      surface: 'room',
      surfaceId: 'room-1',
      userId: 'user-1',
      messageId: 'msg-1',
      body: 'borderline, tail throws',
      fastPathScore: 0.4,
    });
    await new Promise((r) => setImmediate(r));

    expect(queue.add).toHaveBeenCalledWith(
      'review-flagged',
      expect.objectContaining({ aiUnavailable: true }),
      expect.any(Object),
    );
  });
});
