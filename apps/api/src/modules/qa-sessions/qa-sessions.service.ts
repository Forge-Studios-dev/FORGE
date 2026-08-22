import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  QaQuestion,
  QaQuestionStatus,
  QaQuestionUpvote,
  QaSession,
  QaSessionStatus,
} from './entities/qa-session.entity';
import { clampLimit, clampPage } from '../../common/utils/pagination.util';

const MAX_TITLE_LENGTH = 200;
const MAX_QUESTION_LENGTH = 1000;
const MAX_OPEN_SESSIONS_PER_CREATOR = 20;

@Injectable()
export class QaSessionsService {
  constructor(
    @InjectRepository(QaSession)
    private readonly sessionRepository: Repository<QaSession>,
    @InjectRepository(QaQuestion)
    private readonly questionRepository: Repository<QaQuestion>,
    @InjectRepository(QaQuestionUpvote)
    private readonly upvoteRepository: Repository<QaQuestionUpvote>,
  ) {}

  async createSession(
    creatorId: string,
    input: { title: string; description?: string; communityId?: string; scheduledAt?: string },
  ): Promise<QaSession> {
    if (!input.title.trim()) throw new BadRequestException('Title is required');

    const openCount = await this.sessionRepository.count({
      where: [
        { creatorId, status: QaSessionStatus.SCHEDULED },
        { creatorId, status: QaSessionStatus.LIVE },
      ],
    });
    if (openCount >= MAX_OPEN_SESSIONS_PER_CREATOR) {
      throw new BadRequestException(
        `Maximum ${MAX_OPEN_SESSIONS_PER_CREATOR} open Q&A sessions per creator`,
      );
    }

    return this.sessionRepository.save(
      this.sessionRepository.create({
        creatorId,
        communityId: input.communityId ?? null,
        title: input.title.trim().slice(0, MAX_TITLE_LENGTH),
        description: input.description?.trim() || null,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        status: QaSessionStatus.SCHEDULED,
      }),
    );
  }

  async updateSession(
    creatorId: string,
    sessionId: string,
    input: Partial<{ title: string; description: string | null; scheduledAt: string | null }>,
  ): Promise<QaSession> {
    const session = await this.findOwned(creatorId, sessionId);
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new BadRequestException('Title is required');
      session.title = title.slice(0, MAX_TITLE_LENGTH);
    }
    if (input.description !== undefined) session.description = input.description?.trim() || null;
    if (input.scheduledAt !== undefined) {
      session.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    }
    return this.sessionRepository.save(session);
  }

  async startSession(creatorId: string, sessionId: string): Promise<QaSession> {
    const session = await this.findOwned(creatorId, sessionId);
    if (session.status === QaSessionStatus.ENDED) {
      throw new BadRequestException('This session has already ended');
    }
    if (session.status === QaSessionStatus.LIVE) return session;
    session.status = QaSessionStatus.LIVE;
    session.startedAt = new Date();
    return this.sessionRepository.save(session);
  }

  async endSession(creatorId: string, sessionId: string): Promise<QaSession> {
    const session = await this.findOwned(creatorId, sessionId);
    if (session.status === QaSessionStatus.ENDED) return session;
    session.status = QaSessionStatus.ENDED;
    session.endedAt = new Date();
    return this.sessionRepository.save(session);
  }

  async deleteSession(creatorId: string, sessionId: string): Promise<{ success: true }> {
    const session = await this.findOwned(creatorId, sessionId);
    await this.sessionRepository.remove(session);
    return { success: true };
  }

  async listForCreator(creatorId: string): Promise<{ data: QaSession[] }> {
    const data = await this.sessionRepository.find({
      where: { creatorId },
      order: { createdAt: 'DESC' },
    });
    return { data };
  }

  async listPublic(
    creatorId: string,
    opts: { page?: unknown; limit?: unknown } = {},
  ): Promise<{ data: QaSession[] }> {
    const take = clampLimit(opts.limit);
    const skip = (clampPage(opts.page) - 1) * take;
    const data = await this.sessionRepository.find({
      where: { creatorId },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
    return { data };
  }

  async getSession(sessionId: string): Promise<QaSession> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Q&A session not found');
    return session;
  }

  async submitQuestion(sessionId: string, authorId: string, body: string): Promise<QaQuestion> {
    const session = await this.getSession(sessionId);
    if (session.status === QaSessionStatus.ENDED) {
      throw new BadRequestException('This Q&A session has ended');
    }
    const trimmed = body.trim();
    if (!trimmed) throw new BadRequestException('Question text is required');

    return this.questionRepository.save(
      this.questionRepository.create({
        sessionId,
        authorId,
        body: trimmed.slice(0, MAX_QUESTION_LENGTH),
        status: QaQuestionStatus.PENDING,
      }),
    );
  }

  async listQuestions(
    sessionId: string,
    sort: 'top' | 'new' = 'top',
  ): Promise<{ data: QaQuestion[] }> {
    await this.getSession(sessionId);
    const data = await this.questionRepository.find({
      where: [
        { sessionId, status: QaQuestionStatus.PENDING },
        { sessionId, status: QaQuestionStatus.ANSWERED },
      ],
      order:
        sort === 'new'
          ? { createdAt: 'DESC' }
          : { upvoteCount: 'DESC', createdAt: 'DESC' },
    });
    return { data };
  }

  async toggleUpvote(
    questionId: string,
    userId: string,
  ): Promise<{ upvoted: boolean; upvoteCount: number }> {
    const question = await this.questionRepository.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');

    const existing = await this.upvoteRepository.findOne({ where: { questionId, userId } });
    if (existing) {
      await this.upvoteRepository.remove(existing);
      await this.questionRepository.decrement({ id: questionId }, 'upvoteCount', 1);
      return { upvoted: false, upvoteCount: Math.max(0, question.upvoteCount - 1) };
    }

    await this.upvoteRepository.save(this.upvoteRepository.create({ questionId, userId }));
    await this.questionRepository.increment({ id: questionId }, 'upvoteCount', 1);
    return { upvoted: true, upvoteCount: question.upvoteCount + 1 };
  }

  async markAnswered(creatorId: string, sessionId: string, questionId: string): Promise<QaQuestion> {
    await this.findOwned(creatorId, sessionId);
    const question = await this.findQuestionInSession(sessionId, questionId);
    question.status = QaQuestionStatus.ANSWERED;
    question.answeredAt = new Date();
    return this.questionRepository.save(question);
  }

  async dismissQuestion(
    creatorId: string,
    sessionId: string,
    questionId: string,
  ): Promise<{ success: true }> {
    await this.findOwned(creatorId, sessionId);
    const question = await this.findQuestionInSession(sessionId, questionId);
    question.status = QaQuestionStatus.DISMISSED;
    await this.questionRepository.save(question);
    return { success: true };
  }

  private async findOwned(creatorId: string, sessionId: string): Promise<QaSession> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId, creatorId } });
    if (!session) throw new NotFoundException('Q&A session not found');
    return session;
  }

  private async findQuestionInSession(sessionId: string, questionId: string): Promise<QaQuestion> {
    const question = await this.questionRepository.findOne({ where: { id: questionId, sessionId } });
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }
}
