import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VideoCommentModerationService } from './video-comment-moderation.service';
import { VIDEO_COMMENT_MODERATION_QUEUE } from './video-comment-moderation.constants';
import { Comment } from '../../engagement/entities/comment.entity';
import { Video } from '../../content/entities/video.entity';
import { AiModerationService } from '../../communities/ai-moderation.service';

describe('VideoCommentModerationService', () => {
  let service: VideoCommentModerationService;
  const commentRepository = {
    findOne: jest.fn(),
    save: jest.fn((row) => row),
  };
  const videoRepository = {
    findOne: jest.fn(),
  };
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const aiModeration = {
    scoreWithOpenAiOnly: jest.fn(),
  };
  const eventEmitter = { emit: jest.fn() };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'ai.moderationLlmEnabled') return true;
      if (key === 'openai.apiKey') return 'sk-test';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoCommentModerationService,
        { provide: getRepositoryToken(Comment), useValue: commentRepository },
        { provide: getRepositoryToken(Video), useValue: videoRepository },
        { provide: getQueueToken(VIDEO_COMMENT_MODERATION_QUEUE), useValue: queue },
        { provide: AiModerationService, useValue: aiModeration },
        { provide: ConfigService, useValue: configService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();
    service = module.get(VideoCommentModerationService);
  });

  it('enqueues a rejudge job when LLM moderation is enabled', () => {
    service.enqueueRegexHeldReview('c1', 'buy cheap followers');
    expect(queue.add).toHaveBeenCalledWith(
      'rejudge',
      { commentId: 'c1', body: 'buy cheap followers' },
      expect.objectContaining({ jobId: 'vcm:c1' }),
    );
  });

  it('auto-releases when OpenAI clears a regex-held comment', async () => {
    commentRepository.findOne.mockResolvedValue({
      id: 'c1',
      videoId: 'v1',
      moderationStatus: 'held',
      user: { id: 'u1' },
    });
    videoRepository.findOne.mockResolvedValue({ id: 'v1', userId: 'owner' });
    aiModeration.scoreWithOpenAiOnly.mockResolvedValue({
      flagged: false,
      score: 0.1,
      reasons: [],
      provider: 'openai',
    });

    await service.rejudgeHeldComment({ commentId: 'c1', body: 'nice tip' });

    expect(commentRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ moderationStatus: 'none' }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'comment.created',
      expect.objectContaining({ videoId: 'v1', videoOwnerId: 'owner' }),
    );
  });

  it('keeps held when OpenAI confirms the flag', async () => {
    commentRepository.findOne.mockResolvedValue({
      id: 'c1',
      videoId: 'v1',
      moderationStatus: 'held',
    });
    aiModeration.scoreWithOpenAiOnly.mockResolvedValue({
      flagged: true,
      score: 0.9,
      reasons: ['openai_moderation'],
      provider: 'openai',
    });

    await service.rejudgeHeldComment({ commentId: 'c1', body: 'spam' });

    expect(commentRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('keeps held when OpenAI is unavailable', async () => {
    commentRepository.findOne.mockResolvedValue({
      id: 'c1',
      moderationStatus: 'held',
    });
    aiModeration.scoreWithOpenAiOnly.mockResolvedValue(null);

    await service.rejudgeHeldComment({ commentId: 'c1', body: 'maybe spam' });

    expect(commentRepository.save).not.toHaveBeenCalled();
  });
});
