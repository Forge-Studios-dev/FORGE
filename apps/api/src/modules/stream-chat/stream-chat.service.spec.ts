import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StreamChatService } from './stream-chat.service';
import { StreamMessage } from './entities/stream-message.entity';
import { StreamModerationAction } from './entities/stream-moderation-action.entity';
import { StreamingService } from '../streaming/streaming.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { Stream, StreamVisibility } from '../streaming/entities/stream.entity';

describe('StreamChatService', () => {
  let service: StreamChatService;
  let streamingService: { findById: jest.Mock };
  let entitlementsService: { assertAccessAsync: jest.Mock };

  const messageRepository = {
    create: jest.fn((x) => x),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const moderationQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
  };

  const moderationRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    createQueryBuilder: jest.fn(() => moderationQueryBuilder),
  };

  const redis = {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
  };

  beforeEach(async () => {
    streamingService = { findById: jest.fn() };
    entitlementsService = { assertAccessAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamChatService,
        { provide: getRepositoryToken(StreamMessage), useValue: messageRepository },
        { provide: getRepositoryToken(StreamModerationAction), useValue: moderationRepository },
        { provide: StreamingService, useValue: streamingService },
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
      ],
    }).compile();

    service = module.get(StreamChatService);
  });

  it('rejects send when chat is disabled', async () => {
    streamingService.findById.mockResolvedValue({
      id: 's1',
      userId: 'c1',
      chatEnabled: false,
      visibility: StreamVisibility.PUBLIC,
      requiredTierId: null,
    } as Stream);

    await expect(
      service.sendMessage('s1', 'u1', { body: 'hello' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('checks entitlements for non-owner viewers', async () => {
    streamingService.findById.mockResolvedValue({
      id: 's1',
      userId: 'c1',
      chatEnabled: true,
      visibility: StreamVisibility.SUBSCRIBERS,
      requiredTierId: null,
      slowModeSeconds: 0,
    } as Stream);

    entitlementsService.assertAccessAsync.mockRejectedValue(
      new ForbiddenException('An active membership is required'),
    );

    await expect(
      service.sendMessage('s1', 'viewer-1', { body: 'hello' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(entitlementsService.assertAccessAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorId: 'c1',
        visibility: StreamVisibility.SUBSCRIBERS,
        viewerId: 'viewer-1',
      }),
    );
  });

  it('skips entitlement check for stream owner', async () => {
    streamingService.findById.mockResolvedValue({
      id: 's1',
      userId: 'c1',
      chatEnabled: true,
      visibility: StreamVisibility.SUBSCRIBERS,
      requiredTierId: null,
      slowModeSeconds: 0,
    } as Stream);

    messageRepository.save.mockResolvedValue({ id: 'm1', streamId: 's1', userId: 'c1', body: 'hi' });
    messageRepository.findOne.mockResolvedValue({
      id: 'm1',
      streamId: 's1',
      userId: 'c1',
      body: 'hi',
      createdAt: new Date(),
      user: { displayName: 'Creator' },
    });

    await service.sendMessage('s1', 'c1', { body: 'hello' });

    expect(entitlementsService.assertAccessAsync).not.toHaveBeenCalled();
  });

  it('gates chat history for non-entitled viewers', async () => {
    streamingService.findById.mockResolvedValue({
      id: 's1',
      userId: 'c1',
      chatEnabled: true,
      visibility: StreamVisibility.SUBSCRIBERS,
      requiredTierId: null,
    } as Stream);

    entitlementsService.assertAccessAsync.mockRejectedValue(
      new ForbiddenException('An active membership is required'),
    );

    await expect(service.getMessages('s1', 50, undefined, 'viewer-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns chat history when redis is unavailable', async () => {
    streamingService.findById.mockResolvedValue({
      id: 's1',
      userId: 'c1',
      chatEnabled: true,
      visibility: StreamVisibility.PUBLIC,
      requiredTierId: null,
    } as Stream);

    redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
    redis.setex.mockRejectedValue(new Error('ECONNREFUSED'));

    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    messageRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.getMessages('s1');

    expect(result.data).toEqual([]);
    expect(result.meta.hasMore).toBe(false);
  });
});
