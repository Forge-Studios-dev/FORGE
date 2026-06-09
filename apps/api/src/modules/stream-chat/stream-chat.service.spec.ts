import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StreamChatService } from './stream-chat.service';
import { StreamMessage } from './entities/stream-message.entity';
import { StreamModerationAction } from './entities/stream-moderation-action.entity';
import { StreamingService } from '../streaming/streaming.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { Stream, StreamChatMode, StreamVisibility } from '../streaming/entities/stream.entity';
import { ConfigService } from '@nestjs/config';

import { StreamLiveService } from '../streaming/stream-live.service';
import { UsersService } from '../users/users.service';
import { BillingService } from '../billing/billing.service';
import { User } from '../users/entities/user.entity';
import { getQueueToken } from '@nestjs/bullmq';
import { STREAM_CHAT_INGEST_QUEUE } from '../workers/stream-chat-ingest/stream-chat-ingest.constants';

describe('StreamChatService', () => {
  let service: StreamChatService;
  let streamingService: {
    findById: jest.Mock;
    setPinnedMessage: jest.Mock;
    setSlowMode: jest.Mock;
    updateChatSettings: jest.Mock;
  };
  let entitlementsService: { assertAccessAsync: jest.Mock };
  const streamLiveService = {
    canModerate: jest.fn().mockResolvedValue(false),
  };
  const usersService = {
    resolveUserId: jest.fn().mockResolvedValue('target-1'),
  };
  const chatQueue = { add: jest.fn().mockResolvedValue(undefined) };
  const userRepository = { findOne: jest.fn() };

  const messageRepository = {
    create: jest.fn((x) => x),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
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
    delete: jest.fn(),
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
    jest.clearAllMocks();
    streamLiveService.canModerate.mockResolvedValue(false);
    moderationRepository.findOne.mockResolvedValue(null);

    streamingService = {
      findById: jest.fn(),
      setPinnedMessage: jest.fn().mockResolvedValue({}),
      setSlowMode: jest.fn().mockResolvedValue({}),
      updateChatSettings: jest.fn().mockResolvedValue({
        chatEnabled: true,
        chatMode: StreamChatMode.FOLLOWERS,
      }),
    };
    entitlementsService = { assertAccessAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamChatService,
        { provide: getRepositoryToken(StreamMessage), useValue: messageRepository },
        { provide: getRepositoryToken(StreamModerationAction), useValue: moderationRepository },
        { provide: StreamingService, useValue: streamingService },
        { provide: StreamLiveService, useValue: streamLiveService },
        { provide: UsersService, useValue: usersService },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getQueueToken(STREAM_CHAT_INGEST_QUEUE), useValue: chatQueue },
        { provide: EntitlementsService, useValue: entitlementsService },
        {
          provide: BillingService,
          useValue: { isBillingEnabled: jest.fn().mockReturnValue(false), createSuperChatCheckout: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'stream.profanityFilterEnabled') return true;
              if (key === 'nodeEnv') return 'test';
              if (key === 'stream.chatAsync') return false;
              return undefined;
            },
          },
        },
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

    messageRepository.find.mockResolvedValue([]);

    const result = await service.getMessages('s1');

    expect(result.data).toEqual([]);
    expect(result.meta.hasMore).toBe(false);
  });

  it('allows delegated moderators to pin via allowModerator flag', async () => {
    streamLiveService.canModerate.mockResolvedValue(true);
    messageRepository.findOne.mockResolvedValue({ id: 'm1', streamId: 's1' });

    await service.setPinnedMessage('s1', 'mod-1', 'm1', null);

    expect(streamingService.setPinnedMessage).toHaveBeenCalledWith('mod-1', 's1', 'm1', {
      isAdmin: false,
      allowModerator: true,
    });
  });

  it('allows delegated moderators to set slow mode', async () => {
    streamLiveService.canModerate.mockResolvedValue(true);

    await service.setSlowMode('s1', 'mod-1', 10, null);

    expect(streamingService.setSlowMode).toHaveBeenCalledWith('mod-1', 's1', 10, {
      allowModerator: true,
    });
  });

  it('rejects send when chat mode is mods_only for viewers', async () => {
    streamingService.findById.mockResolvedValue({
      id: 's1',
      userId: 'c1',
      chatEnabled: true,
      chatMode: StreamChatMode.MODS_ONLY,
      visibility: StreamVisibility.PUBLIC,
      requiredTierId: null,
      slowModeSeconds: 0,
    } as Stream);

    await expect(
      service.sendMessage('s1', 'viewer-1', { body: 'hello' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires followers for followers-only chat mode', async () => {
    streamingService.findById.mockResolvedValue({
      id: 's1',
      userId: 'c1',
      chatEnabled: true,
      chatMode: StreamChatMode.FOLLOWERS,
      visibility: StreamVisibility.PUBLIC,
      requiredTierId: null,
      slowModeSeconds: 0,
    } as Stream);

    entitlementsService.assertAccessAsync
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ForbiddenException('Follow this creator to access this content'));

    await expect(
      service.sendMessage('s1', 'viewer-1', { body: 'hello' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(entitlementsService.assertAccessAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        creatorId: 'c1',
        visibility: StreamVisibility.FOLLOWERS,
        viewerId: 'viewer-1',
      }),
    );
  });

  it('allows delegated moderators to update chat settings', async () => {
    streamLiveService.canModerate.mockResolvedValue(true);

    const result = await service.setChatSettings('s1', 'mod-1', { chatMode: StreamChatMode.SUBSCRIBERS });

    expect(streamingService.updateChatSettings).toHaveBeenCalledWith('s1', {
      chatEnabled: undefined,
      chatMode: StreamChatMode.SUBSCRIBERS,
    });
    expect(result.chatMode).toBe(StreamChatMode.FOLLOWERS);
  });

  it('allows delegated moderators to unban by username', async () => {
    streamLiveService.canModerate.mockResolvedValue(true);
    usersService.resolveUserId.mockResolvedValue('banned-1');

    await service.unbanUser('s1', 'mod-1', { targetUsername: 'banneduser' });

    expect(moderationRepository.delete).toHaveBeenCalledWith({
      streamId: 's1',
      targetUserId: 'banned-1',
      action: 'ban',
    });
  });
});
