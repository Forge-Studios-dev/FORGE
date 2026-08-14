import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { DirectMessagesService } from './direct-messages.service';
import { Conversation } from './entities/conversation.entity';
import { ConversationMember } from './entities/conversation-member.entity';
import { DirectMessage } from './entities/direct-message.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { EngagementService } from '../engagement/engagement.service';

describe('DirectMessagesService', () => {
  let service: DirectMessagesService;

  const memberRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(async (m: ConversationMember) => m),
    count: jest.fn(),
  };
  const messageRepository = {
    create: jest.fn((dto: Partial<DirectMessage>) => dto),
    save: jest.fn(async (dto: Partial<DirectMessage>) => ({
      id: 'msg-1',
      createdAt: new Date('2026-06-01T12:00:00Z'),
      ...dto,
    })),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const conversationRepository = {
    update: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const userRepository = {
    findOne: jest.fn(),
    findByIds: jest.fn(),
  };
  const eventEmitter = { emit: jest.fn() };
  const notificationsService = { create: jest.fn() };
  const engagementService = {
    isBlockedEitherWay: jest.fn().mockResolvedValue(false),
    getBlockedPeerIds: jest.fn().mockResolvedValue([]),
  };

  const sender: User = {
    id: 'user-a',
    email: 'a@example.com',
    username: 'usera',
    displayName: 'User A',
    role: UserRole.USER,
    isVerified: true,
    followerCount: 0,
    followingCount: 0,
    videoCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const recipient: User = {
    ...sender,
    id: 'user-b',
    email: 'b@example.com',
    username: 'userb',
    displayName: 'User B',
  } as User;

  const conversation: Conversation = {
    id: 'conv-1',
    isGroup: false,
    name: null,
    creatorId: null,
    members: [],
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const msgQb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };

  const convQb = {
    innerJoin: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
  };

  const dataSource = {
    transaction: jest.fn(async (work: (manager: unknown) => Promise<Conversation>) =>
      work({
        save: jest.fn(async (entity: Conversation | ConversationMember) => {
          if (entity instanceof Object && 'conversationId' in entity) return entity;
          return { ...conversation, id: 'conv-new' };
        }),
        create: jest.fn((_entity: unknown, dto: object) => dto),
      }),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    memberRepository.findOne.mockResolvedValue({ userId: 'user-a', conversationId: 'conv-1' });
    messageRepository.createQueryBuilder.mockReturnValue(msgQb);
    conversationRepository.createQueryBuilder.mockReturnValue(convQb);
    userRepository.findOne.mockResolvedValue(recipient);
    messageRepository.findOne.mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-a',
      content: 'Hello',
      createdAt: new Date('2026-06-01T12:00:00Z'),
      sender,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DirectMessagesService,
        { provide: getRepositoryToken(Conversation), useValue: conversationRepository },
        { provide: getRepositoryToken(ConversationMember), useValue: memberRepository },
        { provide: getRepositoryToken(DirectMessage), useValue: messageRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: EngagementService, useValue: engagementService },
      ],
    }).compile();

    service = module.get(DirectMessagesService);
  });

  describe('sendMessage', () => {
    it('rejects messaging yourself', async () => {
      await expect(
        service.sendMessage('user-a', { recipientId: 'user-a', content: 'hi' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unknown recipient', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(
        service.sendMessage('user-a', { recipientId: 'missing', content: 'hi' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects messaging a blocked user', async () => {
      engagementService.isBlockedEitherWay.mockResolvedValueOnce(true);
      await expect(
        service.sendMessage('user-a', { recipientId: 'user-b', content: 'hi' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('sends message, emits socket event, and notifies recipient', async () => {
      convQb.getOne.mockResolvedValue(conversation);

      const result = await service.sendMessage('user-a', {
        recipientId: 'user-b',
        content: '  Hello there  ',
      });

      expect(messageRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-1',
          senderId: 'user-a',
          content: 'Hello there',
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'direct-message.sent',
        expect.objectContaining({
          conversationId: 'conv-1',
          recipientIds: ['user-b'],
        }),
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-b',
          type: NotificationType.DIRECT_MESSAGE,
        }),
      );
      expect(result.content).toBe('Hello');
    });

    it('creates a new conversation when none exists', async () => {
      convQb.getOne.mockResolvedValue(null);

      await service.sendMessage('user-a', { recipientId: 'user-b', content: 'Hi' });

      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });

  describe('getMessages', () => {
    it('denies non-members', async () => {
      memberRepository.findOne.mockResolvedValue(null);
      await expect(service.getMessages('outsider', 'conv-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('returns messages in chronological order', async () => {
      const older = {
        id: 'm1',
        conversationId: 'conv-1',
        senderId: 'user-a',
        content: 'first',
        createdAt: new Date('2026-06-01T11:00:00Z'),
        sender,
      } as DirectMessage;
      const newer = {
        id: 'm2',
        conversationId: 'conv-1',
        senderId: 'user-b',
        content: 'second',
        createdAt: new Date('2026-06-01T12:00:00Z'),
        sender: recipient,
      } as DirectMessage;
      msgQb.getMany.mockResolvedValue([newer, older]);

      const result = await service.getMessages('user-a', 'conv-1', 50);

      expect(result.data.map((m) => m.content)).toEqual(['first', 'second']);
      expect(result.meta.hasMore).toBe(false);
    });
  });

  describe('markRead', () => {
    it('denies non-members', async () => {
      memberRepository.findOne.mockResolvedValue(null);
      await expect(service.markRead('outsider', 'conv-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('updates lastReadAt for members', async () => {
      const member = { userId: 'user-a', conversationId: 'conv-1', lastReadAt: null };
      memberRepository.findOne.mockResolvedValue(member);

      const result = await service.markRead('user-a', 'conv-1');

      expect(result).toEqual({ ok: true });
      expect(memberRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastReadAt: expect.any(Date) }),
      );
    });
  });

  describe('listConversations', () => {
    it('lists conversations with other participants only', async () => {
      memberRepository.find.mockResolvedValue([
        {
          conversationId: 'conv-1',
          lastReadAt: null,
          conversation: {
            members: [
              { userId: 'user-a', user: sender },
              { userId: 'user-b', user: recipient },
            ],
          },
        },
      ]);

      const result = await service.listConversations('user-a');

      expect(result).toHaveLength(1);
      expect(result[0].conversationId).toBe('conv-1');
      expect(result[0].participants).toHaveLength(1);
      expect(result[0].participants[0].id).toBe('user-b');
    });

    it('hides conversations with blocked peers', async () => {
      engagementService.getBlockedPeerIds.mockResolvedValueOnce(['user-b']);
      memberRepository.find.mockResolvedValue([
        {
          conversationId: 'conv-1',
          lastReadAt: null,
          conversation: {
            members: [
              { userId: 'user-a', user: sender },
              { userId: 'user-b', user: recipient },
            ],
          },
        },
      ]);

      const result = await service.listConversations('user-a');
      expect(result).toHaveLength(0);
    });
  });

  describe('createGroupConversation', () => {
    it('rejects creating a group that includes a blocked peer', async () => {
      userRepository.findByIds.mockResolvedValue([
        sender,
        recipient,
        { ...sender, id: 'user-c', username: 'userc' },
      ]);
      engagementService.isBlockedEitherWay.mockImplementation(async (a: string, b: string) =>
        (a === 'user-a' && b === 'user-b') || (a === 'user-b' && b === 'user-a'),
      );

      await expect(
        service.createGroupConversation('user-a', 'Study', ['user-b', 'user-c']),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('addGroupMember', () => {
    it('rejects adding a blocked peer to a group', async () => {
      conversationRepository.findOne.mockResolvedValue({
        id: 'conv-1',
        isGroup: true,
      });
      memberRepository.count.mockResolvedValue(3);
      memberRepository.findOne
        .mockResolvedValueOnce({ userId: 'user-a', conversationId: 'conv-1' })
        .mockResolvedValueOnce(null);
      engagementService.isBlockedEitherWay.mockResolvedValueOnce(true);

      await expect(
        service.addGroupMember('user-a', 'conv-1', 'user-b'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
