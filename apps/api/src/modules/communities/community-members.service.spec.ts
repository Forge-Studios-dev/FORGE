import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommunityMembersService } from './community-members.service';
import { CommunityMember, CommunityMemberStatus } from './entities/community-member.entity';
import { CommunitiesService } from './communities.service';
import { CommunityVisibility } from './entities/community.entity';

describe('CommunityMembersService', () => {
  let service: CommunityMembersService;
  const memberRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (x) => x),
    create: jest.fn((x) => x),
  };
  const communitiesService = {
    assertCanRequestJoin: jest.fn(),
    assertOwnedCommunity: jest.fn(),
    assertCommunityStudioAccess: jest.fn(),
  };
  const eventEmitter = { emit: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityMembersService,
        { provide: getRepositoryToken(CommunityMember), useValue: memberRepository },
        { provide: CommunitiesService, useValue: communitiesService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();
    service = module.get(CommunityMembersService);
    jest.clearAllMocks();
  });

  it('creates pending join request without requiring community access', async () => {
    communitiesService.assertCanRequestJoin.mockResolvedValue({
      id: 'comm-1',
      visibility: CommunityVisibility.PRIVATE,
    });
    memberRepository.findOne.mockResolvedValue(null);

    const result = await service.requestJoin('user-1', 'comm-1');

    expect(communitiesService.assertCanRequestJoin).toHaveBeenCalledWith('comm-1', 'user-1', undefined);
    expect(memberRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        communityId: 'comm-1',
        userId: 'user-1',
        status: CommunityMemberStatus.PENDING,
      }),
    );
    expect(result.pending).toBe(true);
  });

  it('provisions subscription-sourced active member', async () => {
    memberRepository.findOne.mockResolvedValue(null);

    await service.provisionFromSubscription('user-1', 'comm-1');

    expect(memberRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        communityId: 'comm-1',
        userId: 'user-1',
        status: CommunityMemberStatus.ACTIVE,
        source: 'subscription',
      }),
    );
  });

  it('approves member and emits access cache bust event', async () => {
    communitiesService.assertCommunityStudioAccess.mockResolvedValue({
      id: 'comm-1',
      creatorId: 'creator-1',
    });
    memberRepository.findOne.mockResolvedValue({
      communityId: 'comm-1',
      userId: 'user-1',
      status: CommunityMemberStatus.PENDING,
    });

    await service.approveMember('creator-1', 'comm-1', 'user-1');

    expect(eventEmitter.emit).toHaveBeenCalledWith('community.access.changed', {
      userId: 'user-1',
      creatorId: 'creator-1',
      communityId: 'comm-1',
    });
  });

  it('rejects duplicate active member join request', async () => {
    communitiesService.assertCanRequestJoin.mockResolvedValue({ id: 'comm-1' });
    memberRepository.findOne.mockResolvedValue({
      communityId: 'comm-1',
      userId: 'user-1',
      status: CommunityMemberStatus.ACTIVE,
    });

    await expect(service.requestJoin('user-1', 'comm-1')).rejects.toThrow(BadRequestException);
  });
});
