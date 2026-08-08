import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommunityGroupsService } from './community-groups.service';
import {
  CommunityGroup,
  CommunityGroupMember,
  CommunityGroupType,
} from './entities/community-group.entity';
import { CommunitiesService } from './communities.service';

describe('CommunityGroupsService', () => {
  let service: CommunityGroupsService;
  const groupRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(async (g: CommunityGroup) => ({ ...g, id: g.id ?? 'group-1' })),
    create: jest.fn((dto: Partial<CommunityGroup>) => dto),
    delete: jest.fn(),
  };
  const memberRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(async (m: CommunityGroupMember) => m),
    create: jest.fn((dto: Partial<CommunityGroupMember>) => dto),
    count: jest.fn(),
    delete: jest.fn(),
  };
  const communitiesService = {
    assertCommunityAccess: jest.fn().mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityGroupsService,
        { provide: getRepositoryToken(CommunityGroup), useValue: groupRepository },
        { provide: getRepositoryToken(CommunityGroupMember), useValue: memberRepository },
        { provide: CommunitiesService, useValue: communitiesService },
      ],
    }).compile();
    service = module.get(CommunityGroupsService);
  });

  it('gates listGroups on community access', async () => {
    groupRepository.find.mockResolvedValue([]);
    await service.listGroups('comm-1', CommunityGroupType.STUDY, 'user-1', null);
    expect(communitiesService.assertCommunityAccess).toHaveBeenCalledWith(
      'comm-1',
      'user-1',
      null,
    );
  });

  it('refuses join when community access is denied', async () => {
    groupRepository.findOne.mockResolvedValue({
      id: 'group-1',
      communityId: 'comm-1',
      maxMembers: null,
    });
    communitiesService.assertCommunityAccess.mockRejectedValueOnce(
      new ForbiddenException('This community is not available'),
    );
    await expect(service.joinGroup('user-1', 'group-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
