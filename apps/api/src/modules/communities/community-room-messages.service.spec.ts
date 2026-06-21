import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException } from '@nestjs/common';
import { CommunityRoomMessagesService } from './community-room-messages.service';
import { CommunityRoom, CommunityRoomType } from './entities/community-room.entity';
import { CommunityRoomMessage } from './entities/community-room-message.entity';
import { CommunitiesService } from './communities.service';
import { CommunityModerationService } from './community-moderation.service';
import { AiCommunityService } from './ai-community.service';
import { CommunityModerationQueueService } from './community-moderation-queue.service';
import { AccessSessionsService } from '../access-sessions/access-sessions.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { CommunityRoomPermissionsService } from './community-room-permissions.service';

describe('CommunityRoomMessagesService', () => {
  let service: CommunityRoomMessagesService;

  const roomRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: 'room-1',
      communityId: 'comm-1',
      roomType: CommunityRoomType.TEXT,
      isActive: true,
      community: { creatorId: 'creator-1' },
    }),
  };
  const messageRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => ({ id: 'msg-1', ...x, createdAt: new Date() })),
  };
  const communitiesService = {
    assertCommunityAccess: jest.fn().mockResolvedValue({
      id: 'comm-1',
      creatorId: 'creator-1',
      visibility: 'public',
    }),
    canModerateCommunity: jest.fn().mockResolvedValue(false),
  };
  const moderationService = { isBanned: jest.fn().mockResolvedValue(false) };
  const aiCommunityService = {
    scoreContent: jest.fn().mockReturnValue({ flagged: false, score: 0, reasons: [], model: 'regex' }),
  };
  const moderationQueueService = { enqueueFlaggedMessage: jest.fn() };
  const accessSessionsService = { requirePremiumSession: jest.fn() };
  const entitlementsService = {
    getActiveTierNamesByUserIds: jest.fn().mockResolvedValue(new Map()),
  };
  const roomPermissionsService = {
    assertRoomPermissionIfRestricted: jest.fn().mockResolvedValue(undefined),
    hasRoomPermission: jest.fn().mockResolvedValue(false),
  };
  const redis = { set: jest.fn().mockResolvedValue('OK') };
  const eventEmitter = { emit: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityRoomMessagesService,
        { provide: getRepositoryToken(CommunityRoom), useValue: roomRepository },
        { provide: getRepositoryToken(CommunityRoomMessage), useValue: messageRepository },
        { provide: CommunitiesService, useValue: communitiesService },
        { provide: CommunityModerationService, useValue: moderationService },
        { provide: AiCommunityService, useValue: aiCommunityService },
        { provide: CommunityModerationQueueService, useValue: moderationQueueService },
        { provide: AccessSessionsService, useValue: accessSessionsService },
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: CommunityRoomPermissionsService, useValue: roomPermissionsService },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
      ],
    }).compile();
    service = module.get(CommunityRoomMessagesService);
  });

  it('lists messages after access check', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    messageRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.listMessages('comm-1', 'room-1', 50, undefined, undefined, 'user-1');
    expect(result.data).toEqual([]);
    expect(communitiesService.assertCommunityAccess).toHaveBeenCalled();
  });

  it('blocks spam messages', async () => {
    aiCommunityService.scoreContent.mockReturnValue({
      flagged: true,
      score: 0.9,
      reasons: ['pattern_match'],
      model: 'regex',
    });
    await expect(
      service.sendMessage('comm-1', 'room-1', 'user-1', 'buy now click here free money spam'),
    ).rejects.toThrow(ForbiddenException);
  });
});
