import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CommunitiesService } from './communities.service';
import { CommunityMembersService } from './community-members.service';

export type CommunityAccessChangedEvent = {
  userId: string;
  creatorId: string;
  communityId?: string | null;
};

export type CommunityMemberProvisionEvent = {
  userId: string;
  communityId: string;
};

export type CommunityMemberSuspendEvent = {
  userId: string;
  communityId: string;
};

/** Keeps list visibility cache and subscription-sourced members in sync. */
@Injectable()
export class CommunityAccessListener {
  constructor(
    private readonly communitiesService: CommunitiesService,
    private readonly membersService: CommunityMembersService,
  ) {}

  @OnEvent('community.access.changed')
  async onAccessChanged(payload: CommunityAccessChangedEvent): Promise<void> {
    await this.communitiesService.bustCommunityListCache(payload.userId, payload.creatorId);
  }

  @OnEvent('community.member.provision')
  async onMemberProvision(payload: CommunityMemberProvisionEvent): Promise<void> {
    await this.membersService.provisionFromSubscription(payload.userId, payload.communityId);
  }

  @OnEvent('community.member.suspend')
  async onMemberSuspend(payload: CommunityMemberSuspendEvent): Promise<void> {
    await this.membersService.suspendFromSubscriptionLoss(payload.userId, payload.communityId);
  }
}
