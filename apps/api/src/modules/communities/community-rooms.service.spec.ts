import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommunityRoomsService } from './community-rooms.service';
import { Community } from './entities/community.entity';
import { CommunityRoom, CommunityRoomType } from './entities/community-room.entity';
import { CommunityRoomLivekitService } from './community-room-livekit.service';
import { CommunitiesService } from './communities.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { CommunityRoomPermissionsService } from './community-room-permissions.service';

describe('CommunityRoomsService', () => {
  let service: CommunityRoomsService;

  const communityRepository = { findOne: jest.fn() };
  const afterLiveQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
  };
  const roomRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((input) => input),
    createQueryBuilder: jest.fn(() => afterLiveQb),
  };
  const livekitService = {
    isConfigured: jest.fn().mockReturnValue(true),
    ensureRoom: jest.fn().mockResolvedValue('forge-community-c1-r1'),
    createJoinToken: jest.fn().mockResolvedValue({
      token: 'jwt',
      roomName: 'lk',
      livekitUrl: 'wss://lk',
    }),
    revokePublish: jest.fn().mockResolvedValue(undefined),
    endRoom: jest.fn().mockResolvedValue(undefined),
    getParticipantCount: jest.fn().mockResolvedValue(0),
  };
  const communitiesService = {
    assertCommunityAccess: jest.fn().mockResolvedValue({ id: 'comm-1', creatorId: 'c1' }),
    assertCommunityStudioAccess: jest.fn().mockResolvedValue({ id: 'comm-1', creatorId: 'c1' }),
    canModerateCommunity: jest.fn().mockResolvedValue(false),
  };
  const entitlementsService = {
    meetsTierRequirement: jest.fn().mockResolvedValue(true),
  };
  const roomPermissionsService = {
    assertRoomPermissionIfRestricted: jest.fn().mockResolvedValue(undefined),
    hasRoomPermission: jest.fn().mockResolvedValue(false),
  };
  const redis = {
    hset: jest.fn(),
    hdel: jest.fn(),
    hgetall: jest.fn().mockResolvedValue({}),
    expire: jest.fn(),
    sismember: jest.fn().mockResolvedValue(0),
    sadd: jest.fn(),
    srem: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    afterLiveQb.where.mockReturnThis();
    afterLiveQb.andWhere.mockReturnThis();
    afterLiveQb.getOne.mockResolvedValue(null);
    livekitService.isConfigured.mockReturnValue(true);
    communitiesService.assertCommunityAccess.mockResolvedValue({ id: 'comm-1', creatorId: 'c1' });
    communitiesService.canModerateCommunity.mockResolvedValue(false);
    entitlementsService.meetsTierRequirement.mockResolvedValue(true);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityRoomsService,
        { provide: getRepositoryToken(Community), useValue: communityRepository },
        { provide: getRepositoryToken(CommunityRoom), useValue: roomRepository },
        { provide: CommunityRoomLivekitService, useValue: livekitService },
        { provide: CommunitiesService, useValue: communitiesService },
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: CommunityRoomPermissionsService, useValue: roomPermissionsService },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(CommunityRoomsService);
  });

  it('lists active rooms', async () => {
    roomRepository.find.mockResolvedValue([{ id: 'r1', name: 'General' }]);
    const result = await service.listRooms('comm-1');
    expect(result.data).toHaveLength(1);
  });

  it('creates text room for owner', async () => {
    communityRepository.findOne.mockResolvedValue({ id: 'comm-1', creatorId: 'c1' });
    roomRepository.findOne.mockResolvedValue(null);
    roomRepository.save.mockResolvedValue({ id: 'r1', name: 'Lounge', slug: 'lounge', roomType: 'text' });

    const result = await service.createRoom('c1', 'comm-1', { name: 'Lounge' });
    expect(result.data.slug).toBe('lounge');
  });

  it('creates VIP voice room with tier setting', async () => {
    communityRepository.findOne.mockResolvedValue({ id: 'comm-1', creatorId: 'c1' });
    roomRepository.findOne.mockResolvedValue(null);
    roomRepository.save
      .mockResolvedValueOnce({
        id: 'r1',
        name: 'VIP Lounge',
        slug: 'vip-lounge',
        roomType: 'voice',
        settings: { requiredTierId: 'tier-vip' },
      })
      .mockResolvedValueOnce({ id: 'r1', settings: { requiredTierId: 'tier-vip', livekitRoomName: 'lk' } });

    await service.createRoom('c1', 'comm-1', {
      name: 'VIP Lounge',
      roomType: CommunityRoomType.VOICE,
      requiredTierId: 'tier-vip',
    });
    expect(roomRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: { requiredTierId: 'tier-vip' },
      }),
    );
  });

  it('creates voice room when LiveKit configured', async () => {
    communityRepository.findOne.mockResolvedValue({ id: 'comm-1', creatorId: 'c1' });
    roomRepository.findOne.mockResolvedValue(null);
    roomRepository.save
      .mockResolvedValueOnce({ id: 'r1', name: 'Voice', slug: 'voice', roomType: 'voice', settings: {} })
      .mockResolvedValueOnce({ id: 'r1', settings: { livekitRoomName: 'lk' } });

    await service.createRoom('c1', 'comm-1', { name: 'Voice', roomType: CommunityRoomType.VOICE });
    expect(livekitService.ensureRoom).toHaveBeenCalled();
  });

  it('rejects voice room when LiveKit not configured', async () => {
    livekitService.isConfigured.mockReturnValue(false);
    communityRepository.findOne.mockResolvedValue({ id: 'comm-1', creatorId: 'c1' });
    roomRepository.findOne.mockResolvedValue(null);
    await expect(
      service.createRoom('c1', 'comm-1', { name: 'Voice', roomType: CommunityRoomType.VOICE }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('join token rejects VIP room when tier not met', async () => {
    roomRepository.findOne.mockResolvedValue({
      id: 'r1',
      communityId: 'comm-1',
      roomType: CommunityRoomType.VOICE,
      settings: { requiredTierId: 'tier-vip' },
      isActive: true,
    });
    entitlementsService.meetsTierRequirement.mockResolvedValue(false);
    await expect(service.joinRoomToken('u1', 'comm-1', 'r1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('stage join token grants publish for hosts', async () => {
    roomRepository.findOne.mockResolvedValue({
      id: 'r1',
      name: 'Stage',
      communityId: 'comm-1',
      roomType: CommunityRoomType.STAGE,
      settings: {},
      isActive: true,
    });
    communitiesService.canModerateCommunity.mockResolvedValue(true);
    const result = await service.joinRoomToken('host-1', 'comm-1', 'r1');
    expect(result.data.canPublish).toBe(true);
    expect(livekitService.createJoinToken).toHaveBeenCalledWith(
      expect.objectContaining({ canPublish: true }),
    );
  });

  describe('joinRoomToken — capacity enforcement', () => {
    it('rejects a regular participant when the room is at its live capacity, checked against the current DB value (not a stale LiveKit-only cap)', async () => {
      roomRepository.findOne.mockResolvedValue({
        id: 'r1',
        communityId: 'comm-1',
        roomType: CommunityRoomType.VOICE,
        settings: {},
        isActive: true,
        maxParticipants: 5,
      });
      communitiesService.canModerateCommunity.mockResolvedValue(false);
      livekitService.getParticipantCount.mockResolvedValue(5);

      await expect(service.joinRoomToken('u1', 'comm-1', 'r1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(livekitService.createJoinToken).not.toHaveBeenCalled();
    });

    it('allows a host/moderator to join even when the room is at capacity', async () => {
      roomRepository.findOne.mockResolvedValue({
        id: 'r1',
        communityId: 'comm-1',
        roomType: CommunityRoomType.VOICE,
        settings: {},
        isActive: true,
        maxParticipants: 5,
      });
      communitiesService.canModerateCommunity.mockResolvedValue(true);
      livekitService.getParticipantCount.mockResolvedValue(5);

      const result = await service.joinRoomToken('host-1', 'comm-1', 'r1');

      expect(result.data.token).toBe('jwt');
      expect(livekitService.getParticipantCount).not.toHaveBeenCalled();
    });

    it('allows joining when under capacity', async () => {
      roomRepository.findOne.mockResolvedValue({
        id: 'r1',
        communityId: 'comm-1',
        roomType: CommunityRoomType.VOICE,
        settings: {},
        isActive: true,
        maxParticipants: 5,
      });
      communitiesService.canModerateCommunity.mockResolvedValue(false);
      livekitService.getParticipantCount.mockResolvedValue(4);

      const result = await service.joinRoomToken('u1', 'comm-1', 'r1');
      expect(result.data.token).toBe('jwt');
    });
  });

  describe('ensureAfterLiveRoom', () => {
    it('creates a TEXT discussion room linked to the source stream', async () => {
      communitiesService.assertCommunityStudioAccess.mockResolvedValue({ id: 'comm-1', creatorId: 'host-1' });
      afterLiveQb.getOne.mockResolvedValue(null);
      roomRepository.save.mockResolvedValue({ id: 'r-live', roomType: 'text' });

      const room = await service.ensureAfterLiveRoom('host-1', 'comm-1', 'stream-1234abcd', 'My Stream');

      expect(room.id).toBe('r-live');
      expect(roomRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          communityId: 'comm-1',
          roomType: CommunityRoomType.TEXT,
          settings: { sourceStreamId: 'stream-1234abcd' },
        }),
      );
    });

    it('is idempotent and returns the existing room for a repeated stream', async () => {
      communitiesService.assertCommunityStudioAccess.mockResolvedValue({ id: 'comm-1', creatorId: 'host-1' });
      afterLiveQb.getOne.mockResolvedValue({ id: 'r-existing' });

      const room = await service.ensureAfterLiveRoom('host-1', 'comm-1', 'stream-1', 'My Stream');

      expect(room.id).toBe('r-existing');
      expect(roomRepository.save).not.toHaveBeenCalled();
    });

    it('rejects when the host lacks community studio access', async () => {
      communitiesService.assertCommunityStudioAccess.mockRejectedValue(
        new ForbiddenException('Insufficient permissions for community studio'),
      );
      await expect(
        service.ensureAfterLiveRoom('intruder', 'comm-1', 'stream-1', 'My Stream'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(roomRepository.save).not.toHaveBeenCalled();
    });
  });

  it('approves stage speaker for hosts', async () => {
    roomRepository.findOne.mockResolvedValue({
      id: 'r1',
      roomType: CommunityRoomType.STAGE,
      isActive: true,
    });
    communitiesService.canModerateCommunity.mockResolvedValue(true);
    const result = await service.approveStageSpeaker('host-1', 'comm-1', 'r1', 'speaker-1');
    expect(result.data.approved).toBe(true);
    expect(redis.sadd).toHaveBeenCalled();
  });

  describe('demoteStageSpeaker', () => {
    it('removes the speaker from redis and revokes their live LiveKit publish rights (not just at token expiry)', async () => {
      roomRepository.findOne.mockResolvedValue({
        id: 'r1',
        roomType: CommunityRoomType.STAGE,
        isActive: true,
      });
      communitiesService.canModerateCommunity.mockResolvedValue(true);

      const result = await service.demoteStageSpeaker('host-1', 'comm-1', 'r1', 'speaker-1');

      expect(result.data).toEqual({ approved: false, userId: 'speaker-1' });
      expect(redis.srem).toHaveBeenCalled();
      expect(livekitService.revokePublish).toHaveBeenCalledWith('comm-1', 'r1', 'speaker-1');
    });

    it('rejects when the actor cannot moderate the community', async () => {
      roomRepository.findOne.mockResolvedValue({
        id: 'r1',
        roomType: CommunityRoomType.STAGE,
        isActive: true,
      });
      communitiesService.canModerateCommunity.mockResolvedValue(false);

      await expect(
        service.demoteStageSpeaker('intruder', 'comm-1', 'r1', 'speaker-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(livekitService.revokePublish).not.toHaveBeenCalled();
    });
  });

  describe('deactivateRoom', () => {
    it('ends the live LiveKit room so already-connected participants are actually disconnected', async () => {
      communitiesService.assertCommunityStudioAccess.mockResolvedValue({
        id: 'comm-1',
        creatorId: 'host-1',
      });
      roomRepository.findOne.mockResolvedValue({ id: 'r1', isActive: true });

      await service.deactivateRoom('host-1', 'comm-1', 'r1');

      expect(roomRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
      expect(livekitService.endRoom).toHaveBeenCalledWith('comm-1', 'r1');
    });
  });
});
