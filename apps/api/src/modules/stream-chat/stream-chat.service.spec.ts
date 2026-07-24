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
    increment: jest.fn().mockResolvedValue(undefined),
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
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    sismember: jest.fn().mockResolvedValue(0),
    pipeline: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    streamLiveService.canModerate.mockResolvedValue(false);
    moderationRepository.findOne.mockResolvedValue(null);
    redis.sadd.mockResolvedValue(1);
    redis.srem.mockResolvedValue(1);
    redis.sismember.mockResolvedValue(0);
    redis.pipeline.mockReturnValue({
      sismember: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });
    messageRepository.increment.mockResolvedValue(undefined);

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

  describe('sendSuperChat', () => {
    it('blocks super chat while the host is reconnecting (idle grace period)', async () => {
      streamingService.findById.mockResolvedValue({
        id: 's1',
        userId: 'c1',
        chatEnabled: true,
        status: 'live',
        muxIdleSince: new Date(),
        visibility: StreamVisibility.PUBLIC,
        requiredTierId: null,
      } as unknown as Stream);

      await expect(
        service.sendSuperChat('s1', 'viewer-1', { amountCents: 500 } as never),
      ).rejects.toThrow('Super chat is paused while the host is reconnecting');
    });
  });

  describe('handleSuperChatPaid', () => {
    it('does not persist a checkout-fulfilled super chat once the stream has ended', async () => {
      streamingService.findById.mockResolvedValue({
        id: 's1',
        userId: 'c1',
        status: 'ended',
        muxIdleSince: null,
      } as unknown as Stream);

      await service.handleSuperChatPaid({
        streamId: 's1',
        userId: 'viewer-1',
        body: 'hi',
        amountCents: 500,
      });

      expect(messageRepository.save).not.toHaveBeenCalled();
    });

    it('does not persist while the host is mid-reconnect, even if status is still live', async () => {
      streamingService.findById.mockResolvedValue({
        id: 's1',
        userId: 'c1',
        status: 'live',
        muxIdleSince: new Date(),
      } as unknown as Stream);

      await service.handleSuperChatPaid({
        streamId: 's1',
        userId: 'viewer-1',
        body: 'hi',
        amountCents: 500,
      });

      expect(messageRepository.save).not.toHaveBeenCalled();
    });

    it('persists normally when the stream is live and not reconnecting', async () => {
      streamingService.findById.mockResolvedValue({
        id: 's1',
        userId: 'c1',
        status: 'live',
        muxIdleSince: null,
      } as unknown as Stream);
      messageRepository.save.mockResolvedValue({ id: 'm1', streamId: 's1', userId: 'viewer-1', body: 'hi' });
      messageRepository.findOne.mockResolvedValue({
        id: 'm1',
        streamId: 's1',
        userId: 'viewer-1',
        body: 'hi',
        createdAt: new Date(),
        user: { displayName: 'Viewer' },
      });

      await service.handleSuperChatPaid({
        streamId: 's1',
        userId: 'viewer-1',
        body: 'hi',
        amountCents: 500,
      });

      expect(messageRepository.save).toHaveBeenCalled();
    });
  });

  describe('Live Q&A', () => {
    const liveStream = {
      id: 's1',
      userId: 'c1',
      chatEnabled: true,
      visibility: StreamVisibility.PUBLIC,
      requiredTierId: null,
      slowModeSeconds: 0,
      startedAt: new Date(),
    } as Stream;
    const emit = () => (service as unknown as { eventEmitter: { emit: jest.Mock } }).eventEmitter.emit;

    it('persists a question as pending and emits a created event', async () => {
      streamingService.findById.mockResolvedValue(liveStream);
      messageRepository.save.mockResolvedValue({ id: 'q1' });
      messageRepository.findOne.mockResolvedValue({
        id: 'q1',
        streamId: 's1',
        userId: 'c1',
        body: 'Why?',
        questionStatus: 'pending',
        upvotes: 0,
        createdAt: new Date(),
        user: { id: 'c1', displayName: 'Creator' },
      });

      const result = await service.submitQuestion('s1', 'c1', { body: 'Why?' });

      expect(result.status).toBe('pending');
      expect(result.upvotes).toBe(0);
      expect(messageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ messageType: 'question', questionStatus: 'pending' }),
      );
      expect(emit()).toHaveBeenCalledWith('stream.qa.created', expect.objectContaining({ streamId: 's1' }));
    });

    it('enforces entitlements before accepting a question from a non-owner', async () => {
      streamingService.findById.mockResolvedValue({
        ...liveStream,
        visibility: StreamVisibility.SUBSCRIBERS,
      } as Stream);
      entitlementsService.assertAccessAsync.mockRejectedValue(
        new ForbiddenException('An active membership is required'),
      );

      await expect(
        service.submitQuestion('s1', 'viewer-1', { body: 'Question?' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('toggles an upvote on and increments the tally', async () => {
      streamingService.findById.mockResolvedValue(liveStream);
      messageRepository.findOne
        .mockResolvedValueOnce({ id: 'q1', streamId: 's1', messageType: 'question', deletedAt: null })
        .mockResolvedValueOnce({ id: 'q1', streamId: 's1', upvotes: 1, questionStatus: 'pending', user: {} });
      redis.sadd.mockResolvedValue(1);

      const result = await service.upvoteQuestion('s1', 'q1', 'c1');

      expect(result.viewerHasUpvoted).toBe(true);
      expect(messageRepository.increment).toHaveBeenCalledWith({ id: 'q1' }, 'upvotes', 1);
    });

    it('toggles an upvote off when already voted', async () => {
      streamingService.findById.mockResolvedValue(liveStream);
      const updateQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      messageRepository.createQueryBuilder.mockReturnValue(updateQb);
      messageRepository.findOne
        .mockResolvedValueOnce({ id: 'q1', streamId: 's1', messageType: 'question', deletedAt: null })
        .mockResolvedValueOnce({ id: 'q1', streamId: 's1', upvotes: 0, questionStatus: 'pending', user: {} });
      redis.sadd.mockResolvedValue(0);

      const result = await service.upvoteQuestion('s1', 'q1', 'c1');

      expect(result.viewerHasUpvoted).toBe(false);
      expect(redis.srem).toHaveBeenCalledWith('stream:qa:votes:q1', 'c1');
      expect(updateQb.execute).toHaveBeenCalled();
    });

    it('lets a moderator mark a question answered', async () => {
      streamLiveService.canModerate.mockResolvedValue(true);
      messageRepository.findOne
        .mockResolvedValueOnce({ id: 'q1', streamId: 's1', messageType: 'question' })
        .mockResolvedValueOnce({ id: 'q1', streamId: 's1', questionStatus: 'answered', upvotes: 3, user: {} });

      const result = await service.setQuestionStatus('s1', 'q1', 'answered' as never, 'mod-1', null);

      expect(result.status).toBe('answered');
      expect(messageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ questionStatus: 'answered' }),
      );
    });

    it('rejects status changes from non-moderators', async () => {
      streamLiveService.canModerate.mockResolvedValue(false);
      await expect(
        service.setQuestionStatus('s1', 'q1', 'dismissed' as never, 'viewer-1', null),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lists questions sorted by upvotes for the owner', async () => {
      streamingService.findById.mockResolvedValue(liveStream);
      const listQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'q1', streamId: 's1', upvotes: 5, questionStatus: 'pending', user: {} },
        ]),
      };
      messageRepository.createQueryBuilder.mockReturnValue(listQb);

      const result = await service.listQuestions('s1', undefined, 'c1', null);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].upvotes).toBe(5);
      expect(listQb.orderBy).toHaveBeenCalledWith('m.upvotes', 'DESC');
    });
  });
});
