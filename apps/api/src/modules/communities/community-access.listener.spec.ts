import { Test, TestingModule } from '@nestjs/testing';
import { CommunityAccessListener } from './community-access.listener';
import { CommunitiesService } from './communities.service';
import { CommunityMembersService } from './community-members.service';

describe('CommunityAccessListener', () => {
  let listener: CommunityAccessListener;
  const communitiesService = { bustCommunityListCache: jest.fn() };
  const membersService = { provisionFromSubscription: jest.fn(), suspendFromSubscriptionLoss: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityAccessListener,
        { provide: CommunitiesService, useValue: communitiesService },
        { provide: CommunityMembersService, useValue: membersService },
      ],
    }).compile();

    listener = module.get(CommunityAccessListener);
  });

  it('busts list cache on community.access.changed', async () => {
    await listener.onAccessChanged({
      userId: 'user-1',
      creatorId: 'creator-1',
      communityId: 'comm-1',
    });

    expect(communitiesService.bustCommunityListCache).toHaveBeenCalledWith('user-1', 'creator-1');
  });

  it('provisions member on community.member.provision', async () => {
    await listener.onMemberProvision({ userId: 'user-1', communityId: 'comm-1' });

    expect(membersService.provisionFromSubscription).toHaveBeenCalledWith('user-1', 'comm-1');
  });

  it('suspends member on community.member.suspend', async () => {
    await listener.onMemberSuspend({ userId: 'user-1', communityId: 'comm-1' });

    expect(membersService.suspendFromSubscriptionLoss).toHaveBeenCalledWith('user-1', 'comm-1');
  });
});
