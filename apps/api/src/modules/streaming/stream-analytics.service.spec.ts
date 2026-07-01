import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StreamAnalyticsService } from './stream-analytics.service';
import { StreamAnalyticsSnapshot } from './entities/stream-analytics-snapshot.entity';
import { Stream, StreamStatus } from './entities/stream.entity';
import { StreamMessage } from '../stream-chat/entities/stream-message.entity';
import { StreamEventPurchase } from './entities/stream-event-purchase.entity';
import { StreamPollVote } from './entities/stream-poll-vote.entity';
import { UserRole } from '../users/entities/user.entity';

/** Chainable query-builder mock whose terminal method resolves to `terminal`. */
function makeQb(terminal: { method: 'getRawOne' | 'getCount'; value: unknown }) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['select', 'addSelect', 'where', 'andWhere', 'innerJoin', 'groupBy', 'orderBy']) {
    qb[m] = jest.fn().mockReturnValue(qb);
  }
  qb.getRawOne = jest.fn().mockResolvedValue(terminal.method === 'getRawOne' ? terminal.value : null);
  qb.getCount = jest.fn().mockResolvedValue(terminal.method === 'getCount' ? terminal.value : 0);
  return qb;
}

describe('StreamAnalyticsService', () => {
  let service: StreamAnalyticsService;

  const ownerStream = {
    id: 'stream-1',
    userId: 'creator-A',
    status: StreamStatus.LIVE,
    viewerCount: 12,
    uniqueViewerCount: 50,
    startedAt: new Date('2026-07-01T18:00:00Z'),
    endedAt: null,
  } as unknown as Stream;

  const redis = {
    get: jest.fn(),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };
  const snapshotRepository = {
    save: jest.fn(async (e: StreamAnalyticsSnapshot) => e),
    create: jest.fn((e: Partial<StreamAnalyticsSnapshot>) => e),
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(),
  };
  const streamRepository = { findOne: jest.fn() };
  const messageRepository = { count: jest.fn().mockResolvedValue(7), createQueryBuilder: jest.fn() };
  const purchaseRepository = { createQueryBuilder: jest.fn() };
  const pollVoteRepository = { createQueryBuilder: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    streamRepository.findOne.mockResolvedValue(ownerStream);
    snapshotRepository.createQueryBuilder.mockReturnValue(
      makeQb({ method: 'getRawOne', value: { peak: '120', avg: '47.6' } }),
    );
    messageRepository.createQueryBuilder.mockReturnValue(
      makeQb({ method: 'getRawOne', value: { total: '2500' } }),
    );
    purchaseRepository.createQueryBuilder.mockReturnValue(
      makeQb({ method: 'getRawOne', value: { total: '9900', count: '3' } }),
    );
    pollVoteRepository.createQueryBuilder.mockReturnValue(makeQb({ method: 'getCount', value: 4 }));

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        StreamAnalyticsService,
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
        { provide: getRepositoryToken(StreamAnalyticsSnapshot), useValue: snapshotRepository },
        { provide: getRepositoryToken(Stream), useValue: streamRepository },
        { provide: getRepositoryToken(StreamMessage), useValue: messageRepository },
        { provide: getRepositoryToken(StreamEventPurchase), useValue: purchaseRepository },
        { provide: getRepositoryToken(StreamPollVote), useValue: pollVoteRepository },
      ],
    }).compile();

    service = moduleRef.get(StreamAnalyticsService);
  });

  it('computes analytics for the owner and caches the result', async () => {
    const result = await service.getCreatorStreamAnalytics('creator-A', 'stream-1', 'creator-A');

    expect(result.peakViewers).toBe(120);
    expect(result.avgViewers).toBe(48);
    expect(result.superChatRevenueCents).toBe(2500);
    expect(result.ticketRevenueCents).toBe(9900);
    expect(result.ticketSalesCount).toBe(3);
    expect(result.totalPollVotes).toBe(4);
    expect(result.uniqueViewers).toBe(50);
    expect(redis.setex).toHaveBeenCalledWith('stream:analytics:stream-1', 30, expect.any(String));
  });

  // SECURITY REGRESSION: cache-before-authz IDOR. A different creator must never
  // receive another creator's analytics even when the per-stream cache is warm.
  it('does NOT return cached analytics to a non-owner creator (IDOR guard)', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ superChatRevenueCents: 999999, secret: true }));

    await expect(
      service.getCreatorStreamAnalytics('creator-B', 'stream-1', 'creator-B'),
    ).rejects.toBeInstanceOf(NotFoundException);

    // ownership must be checked; cache value must not leak
    expect(streamRepository.findOne).toHaveBeenCalled();
  });

  it('authorizes the owner before consulting the cache (ownership lookup always runs)', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ streamId: 'stream-1', peakViewers: 5 }));

    const result = await service.getCreatorStreamAnalytics('creator-A', 'stream-1', 'creator-A');

    expect(streamRepository.findOne).toHaveBeenCalled();
    expect(result).toEqual({ streamId: 'stream-1', peakViewers: 5 });
  });

  it('returns 404 for a missing stream', async () => {
    streamRepository.findOne.mockResolvedValue(null);
    await expect(
      service.getCreatorStreamAnalytics('creator-A', 'missing', 'creator-A'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows an admin requester on an owned stream', async () => {
    const result = await service.getCreatorStreamAnalytics(
      'creator-A',
      'stream-1',
      'admin-1',
      UserRole.ADMIN,
    );
    expect(result.streamId).toBe('stream-1');
  });

  it('forbids a non-admin requester acting for a different creator', async () => {
    await expect(
      service.getCreatorStreamAnalytics('creator-A', 'stream-1', 'someone-else'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recordSnapshot persists a snapshot and busts the analytics cache', async () => {
    await service.recordSnapshot('stream-1', 88);
    expect(snapshotRepository.save).toHaveBeenCalled();
    expect(snapshotRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ streamId: 'stream-1', concurrentViewers: 88 }),
    );
    expect(redis.del).toHaveBeenCalledWith('stream:analytics:stream-1');
  });
});
