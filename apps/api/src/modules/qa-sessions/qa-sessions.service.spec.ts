import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QaSessionsService } from './qa-sessions.service';
import {
  QaQuestion,
  QaQuestionStatus,
  QaQuestionUpvote,
  QaSession,
  QaSessionStatus,
} from './entities/qa-session.entity';

describe('QaSessionsService', () => {
  let service: QaSessionsService;

  const mockSession: Partial<QaSession> = {
    id: 'session-1',
    creatorId: 'creator-1',
    communityId: null,
    title: 'Ask me anything',
    description: null,
    status: QaSessionStatus.SCHEDULED,
    scheduledAt: null,
    startedAt: null,
    endedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQuestion: Partial<QaQuestion> = {
    id: 'question-1',
    sessionId: 'session-1',
    authorId: 'viewer-1',
    body: 'What is your favorite editing tool?',
    status: QaQuestionStatus.PENDING,
    upvoteCount: 0,
    answeredAt: null,
    createdAt: new Date(),
  };

  const sessionRepository = {
    count: jest.fn().mockResolvedValue(0),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([mockSession]),
    save: jest.fn(async (entity: Partial<QaSession>) => ({ ...mockSession, ...entity })),
    create: jest.fn((dto: Partial<QaSession>) => dto),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const questionRepository = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([mockQuestion]),
    save: jest.fn(async (entity: Partial<QaQuestion>) => ({ ...mockQuestion, ...entity })),
    create: jest.fn((dto: Partial<QaQuestion>) => dto),
    increment: jest.fn().mockResolvedValue(undefined),
    decrement: jest.fn().mockResolvedValue(undefined),
  };

  const upvoteRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (entity: Partial<QaQuestionUpvote>) => entity),
    create: jest.fn((dto: Partial<QaQuestionUpvote>) => dto),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    sessionRepository.count.mockResolvedValue(0);
    sessionRepository.find.mockResolvedValue([mockSession]);
    questionRepository.find.mockResolvedValue([mockQuestion]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QaSessionsService,
        { provide: getRepositoryToken(QaSession), useValue: sessionRepository },
        { provide: getRepositoryToken(QaQuestion), useValue: questionRepository },
        { provide: getRepositoryToken(QaQuestionUpvote), useValue: upvoteRepository },
      ],
    }).compile();

    service = module.get(QaSessionsService);
  });

  describe('createSession', () => {
    it('rejects an empty title', async () => {
      await expect(service.createSession('creator-1', { title: '  ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates a scheduled session', async () => {
      const result = await service.createSession('creator-1', { title: 'AMA' });
      expect(result.status).toBe(QaSessionStatus.SCHEDULED);
    });

    it('rejects when the creator already has too many open sessions', async () => {
      sessionRepository.count.mockResolvedValue(20);
      await expect(service.createSession('creator-1', { title: 'AMA' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('start/end session', () => {
    it('marks a scheduled session live', async () => {
      sessionRepository.findOne.mockResolvedValue({ ...mockSession });
      const result = await service.startSession('creator-1', 'session-1');
      expect(result.status).toBe(QaSessionStatus.LIVE);
      expect(result.startedAt).toBeInstanceOf(Date);
    });

    it('refuses to restart an ended session', async () => {
      sessionRepository.findOne.mockResolvedValue({ ...mockSession, status: QaSessionStatus.ENDED });
      await expect(service.startSession('creator-1', 'session-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when session not owned', async () => {
      sessionRepository.findOne.mockResolvedValue(null);
      await expect(service.startSession('creator-1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitQuestion', () => {
    it('rejects an empty question body', async () => {
      sessionRepository.findOne.mockResolvedValue({ ...mockSession });
      await expect(service.submitQuestion('session-1', 'viewer-1', '  ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects submission to an ended session', async () => {
      sessionRepository.findOne.mockResolvedValue({ ...mockSession, status: QaSessionStatus.ENDED });
      await expect(
        service.submitQuestion('session-1', 'viewer-1', 'A question?'),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a pending question', async () => {
      sessionRepository.findOne.mockResolvedValue({ ...mockSession });
      const result = await service.submitQuestion('session-1', 'viewer-1', 'A question?');
      expect(result.status).toBe(QaQuestionStatus.PENDING);
    });
  });

  describe('toggleUpvote', () => {
    it('adds an upvote when none exists', async () => {
      questionRepository.findOne.mockResolvedValue({ ...mockQuestion });
      upvoteRepository.findOne.mockResolvedValue(null);
      const result = await service.toggleUpvote('question-1', 'viewer-2');
      expect(result.upvoted).toBe(true);
      expect(questionRepository.increment).toHaveBeenCalled();
    });

    it('removes an existing upvote (toggle off)', async () => {
      questionRepository.findOne.mockResolvedValue({ ...mockQuestion, upvoteCount: 1 });
      upvoteRepository.findOne.mockResolvedValue({ id: 'up-1', questionId: 'question-1', userId: 'viewer-2', createdAt: new Date() });
      const result = await service.toggleUpvote('question-1', 'viewer-2');
      expect(result.upvoted).toBe(false);
      expect(questionRepository.decrement).toHaveBeenCalled();
    });

    it('404s when the question does not exist', async () => {
      questionRepository.findOne.mockResolvedValue(null);
      await expect(service.toggleUpvote('nope', 'viewer-2')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAnswered / dismissQuestion', () => {
    it('marks a question answered when the session is owned by the creator', async () => {
      sessionRepository.findOne.mockResolvedValue({ ...mockSession });
      questionRepository.findOne.mockResolvedValue({ ...mockQuestion });
      const result = await service.markAnswered('creator-1', 'session-1', 'question-1');
      expect(result.status).toBe(QaQuestionStatus.ANSWERED);
      expect(result.answeredAt).toBeInstanceOf(Date);
    });

    it('refuses to mark answered for a session the caller does not own', async () => {
      sessionRepository.findOne.mockResolvedValue(null);
      await expect(
        service.markAnswered('not-the-creator', 'session-1', 'question-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('dismisses a question', async () => {
      sessionRepository.findOne.mockResolvedValue({ ...mockSession });
      questionRepository.findOne.mockResolvedValue({ ...mockQuestion });
      const result = await service.dismissQuestion('creator-1', 'session-1', 'question-1');
      expect(result.success).toBe(true);
      expect(questionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: QaQuestionStatus.DISMISSED }),
      );
    });
  });
});
