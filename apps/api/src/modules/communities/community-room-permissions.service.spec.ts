import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommunityRoomPermissionsService } from './community-room-permissions.service';
import { CommunityRoom } from './entities/community-room.entity';
import { CommunityRoomPermissionRow, CommunityRoomPermission } from './entities/community-room-message.entity';
import { CommunitiesService } from './communities.service';
import { CreatorAuditService } from './creator-audit.service';
import { UserRole } from '../users/entities/user.entity';

describe('CommunityRoomPermissionsService', () => {
  let service: CommunityRoomPermissionsService;

  const roomRepository = { findOne: jest.fn() };
  const permissionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x) => x),
    delete: jest.fn(),
    count: jest.fn(),
  };
  const communitiesService = {
    assertOwnedCommunity: jest.fn().mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1' }),
    assertCommunityAccess: jest.fn().mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1' }),
    canModerateCommunity: jest.fn().mockResolvedValue(false),
  };
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    roomRepository.findOne.mockResolvedValue({ id: 'room-1', communityId: 'comm-1', isActive: true });
    permissionRepository.find.mockResolvedValue([]);
    permissionRepository.findOne.mockResolvedValue(null);
    permissionRepository.count.mockResolvedValue(0);
    permissionRepository.save.mockResolvedValue({
      id: 'perm-1',
      roomId: 'room-1',
      userId: 'user-2',
      permission: CommunityRoomPermission.SEND,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityRoomPermissionsService,
        { provide: getRepositoryToken(CommunityRoom), useValue: roomRepository },
        { provide: getRepositoryToken(CommunityRoomPermissionRow), useValue: permissionRepository },
        { provide: CommunitiesService, useValue: communitiesService },
        { provide: CreatorAuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(CommunityRoomPermissionsService);
  });

  it('lists permissions for room owner', async () => {
    const result = await service.listPermissions('creator-1', 'comm-1', 'room-1');
    expect(result.data).toEqual([]);
    expect(communitiesService.assertOwnedCommunity).toHaveBeenCalled();
  });

  it('grants permission and writes audit log', async () => {
    const result = await service.grantPermission(
      'creator-1',
      'comm-1',
      'room-1',
      'user-2',
      CommunityRoomPermission.SEND,
    );
    expect(result.data.userId).toBe('user-2');
    expect(auditService.log).toHaveBeenCalled();
  });

  it('requires explicit grant when room has custom permissions', async () => {
    permissionRepository.count.mockResolvedValue(2);
    communitiesService.canModerateCommunity.mockResolvedValue(false);
    permissionRepository.findOne.mockResolvedValue(null);

    await expect(
      service.assertRoomPermissionIfRestricted(
        'comm-1',
        'room-1',
        'user-2',
        CommunityRoomPermission.VIEW,
        UserRole.USER,
      ),
    ).rejects.toThrow('You do not have permission for this room');
  });
});
