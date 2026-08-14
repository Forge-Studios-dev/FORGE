import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StreamLiveService } from './stream-live.service';
import { StreamModerator } from './entities/stream-moderator.entity';
import { StreamRsvp } from './entities/stream-rsvp.entity';
import { StreamPoll } from './entities/stream-poll.entity';
import { StreamPollVote } from './entities/stream-poll-vote.entity';
import { Stream, StreamVisibility } from './entities/stream.entity';
import { StreamingService } from './streaming.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { UsersService } from '../users/users.service';
import { StreamClip } from './entities/stream-clip.entity';
import { StreamCaption } from './entities/stream-caption.entity';
import { StreamAudienceRequest } from './entities/stream-audience-request.entity';
import { MuxLiveSyncService } from './mux-live-sync.service';
import { ConfigService } from '@nestjs/config';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';

const muxLiveSyncServiceMock = {
  getReconnectAttempts: jest.fn().mockResolvedValue(0),
  reconnectGraceSec: jest.fn().mockReturnValue(60),
};

const redisMock = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  sadd: jest.fn(),
  smembers: jest.fn(),
  expire: jest.fn(),
};

describe('StreamLiveService votePoll', () => {
  let service: StreamLiveService;
  const pollRepository = { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), update: jest.fn() };
  const pollVoteRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const streamingService = {
    findById: jest.fn(),
    assertViewerNotBlockedFromHost: jest.fn().mockImplementation(async (id: string) => ({
      id,
      userId: 'creator-1',
      visibility: StreamVisibility.PUBLIC,
      requiredTierId: null,
    })),
  };
  const entitlementsService = { assertAccessAsync: jest.fn() };
  const usersService = { resolveUserId: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    streamingService.assertViewerNotBlockedFromHost.mockImplementation(async (id: string) => ({
      id,
      userId: 'creator-1',
      visibility: StreamVisibility.PUBLIC,
      requiredTierId: null,
    }));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamLiveService,
        { provide: getRepositoryToken(StreamModerator), useValue: {} },
        { provide: getRepositoryToken(StreamRsvp), useValue: {} },
        { provide: getRepositoryToken(StreamPoll), useValue: pollRepository },
        { provide: getRepositoryToken(StreamPollVote), useValue: pollVoteRepository },
        { provide: getRepositoryToken(Stream), useValue: {} },
        { provide: getRepositoryToken(StreamClip), useValue: { save: jest.fn(), find: jest.fn(), create: jest.fn() } },
        { provide: getRepositoryToken(StreamCaption), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(StreamAudienceRequest), useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn(), create: jest.fn() } },
        { provide: StreamingService, useValue: streamingService },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => (key === 'stream.defaultClipDurationMs' ? 30_000 : undefined) },
        },
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: UsersService, useValue: usersService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: MuxLiveSyncService, useValue: muxLiveSyncServiceMock },
        { provide: getRedisConnectionToken(), useValue: redisMock },
      ],
    }).compile();

    service = module.get(StreamLiveService);
  });

  it('checks entitlements before recording a vote', async () => {
    pollRepository.findOne.mockResolvedValue({
      id: 'poll-1',
      streamId: 'stream-1',
      options: ['A', 'B'],
      isActive: true,
    });
    streamingService.assertViewerNotBlockedFromHost.mockResolvedValue({
      id: 'stream-1',
      userId: 'creator-1',
      visibility: StreamVisibility.SUBSCRIBERS,
      requiredTierId: null,
    });
    entitlementsService.assertAccessAsync.mockRejectedValue(new ForbiddenException());

    await expect(service.votePoll('poll-1', 'viewer-1', 0)).rejects.toBeInstanceOf(ForbiddenException);

    expect(entitlementsService.assertAccessAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorId: 'creator-1',
        viewerId: 'viewer-1',
      }),
    );
  });
});

describe('StreamLiveService poll aggregation', () => {
  let service: StreamLiveService;
  const pollRepository = { findOne: jest.fn() };
  const pollVoteRepository = { createQueryBuilder: jest.fn() };
  const streamingService = {
    assertViewerNotBlockedFromHost: jest.fn().mockResolvedValue({ id: 'stream-1', userId: 'creator-1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    streamingService.assertViewerNotBlockedFromHost.mockResolvedValue({ id: 'stream-1', userId: 'creator-1' });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamLiveService,
        { provide: getRepositoryToken(StreamModerator), useValue: {} },
        { provide: getRepositoryToken(StreamRsvp), useValue: {} },
        { provide: getRepositoryToken(StreamPoll), useValue: pollRepository },
        { provide: getRepositoryToken(StreamPollVote), useValue: pollVoteRepository },
        { provide: getRepositoryToken(Stream), useValue: {} },
        { provide: getRepositoryToken(StreamClip), useValue: {} },
        { provide: getRepositoryToken(StreamCaption), useValue: {} },
        { provide: getRepositoryToken(StreamAudienceRequest), useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn(), create: jest.fn() } },
        { provide: StreamingService, useValue: streamingService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: EntitlementsService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: MuxLiveSyncService, useValue: muxLiveSyncServiceMock },
        { provide: getRedisConnectionToken(), useValue: redisMock },
      ],
    }).compile();
    service = module.get(StreamLiveService);
  });

  it('aggregates vote counts via SQL GROUP BY', async () => {
    pollRepository.findOne.mockResolvedValue({
      id: 'poll-1',
      streamId: 'stream-1',
      question: 'Q?',
      options: ['A', 'B', 'C'],
      isActive: true,
    });
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { optionIndex: 0, count: '3' },
        { optionIndex: 2, count: '1' },
      ]),
    };
    pollVoteRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getActivePoll('stream-1');

    expect(pollVoteRepository.createQueryBuilder).toHaveBeenCalled();
    expect(result?.counts).toEqual([3, 0, 1]);
    expect(result?.totalVotes).toBe(4);
  });
});

describe('StreamLiveService getStreamHealth', () => {
  let service: StreamLiveService;
  const streamingService = {
    findById: jest.fn(),
    assertViewerNotBlockedFromHost: jest.fn().mockImplementation(async (id: string) => ({
      id,
      userId: 'creator-1',
      visibility: StreamVisibility.PUBLIC,
      requiredTierId: null,
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    muxLiveSyncServiceMock.getReconnectAttempts.mockResolvedValue(2);
    muxLiveSyncServiceMock.reconnectGraceSec.mockReturnValue(60);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamLiveService,
        { provide: getRepositoryToken(StreamModerator), useValue: {} },
        { provide: getRepositoryToken(StreamRsvp), useValue: {} },
        { provide: getRepositoryToken(StreamPoll), useValue: {} },
        { provide: getRepositoryToken(StreamPollVote), useValue: {} },
        { provide: getRepositoryToken(Stream), useValue: {} },
        { provide: getRepositoryToken(StreamClip), useValue: {} },
        { provide: getRepositoryToken(StreamCaption), useValue: {} },
        { provide: getRepositoryToken(StreamAudienceRequest), useValue: {} },
        { provide: StreamingService, useValue: streamingService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: EntitlementsService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: MuxLiveSyncService, useValue: muxLiveSyncServiceMock },
        { provide: getRedisConnectionToken(), useValue: redisMock },
      ],
    }).compile();
    service = module.get(StreamLiveService);
  });

  it('reports reconnecting with a computed deadline while host ingest is idle', async () => {
    const idleSince = new Date('2026-01-01T00:00:00Z');
    streamingService.findById.mockResolvedValue({
      id: 'stream-1',
      userId: 'creator-1',
      status: 'live',
      muxIdleSince: idleSince,
      viewerCount: 5,
      livekitEgressId: null,
      startedAt: new Date('2025-12-31T23:00:00Z'),
      muxPlaybackId: null,
      playbackUrl: null,
      endReason: null,
    });

    const health = await service.getStreamHealth('stream-1', 'creator-1');

    expect(health.reconnecting).toBe(true);
    expect(health.reconnectDeadline).toBe('2026-01-01T00:01:00.000Z');
    expect(health.reconnectAttempts).toBe(2);
  });

  it('reports not reconnecting with a null deadline once the host is active', async () => {
    streamingService.findById.mockResolvedValue({
      id: 'stream-1',
      userId: 'creator-1',
      status: 'live',
      muxIdleSince: null,
      viewerCount: 5,
      livekitEgressId: null,
      startedAt: new Date(),
      muxPlaybackId: null,
      playbackUrl: null,
      endReason: null,
    });

    const health = await service.getStreamHealth('stream-1', 'creator-1');

    expect(health.reconnecting).toBe(false);
    expect(health.reconnectDeadline).toBeNull();
  });
});
