import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
  const roomRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((input) => input),
  };
  const livekitService = {
    isConfigured: jest.fn().mockReturnValue(true),
    ensureRoom: jest.fn().mockResolvedValue('forge-community-c1-r1'),
    createJoinToken: jest.fn().mockResolvedValue({
      token: 'jwt',
      roomName: 'lk',
      livekitUrl: 'wss://lk',
    }),
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
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
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
});
