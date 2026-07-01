import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CommunityGroup,
  CommunityGroupMember,
  CommunityGroupMemberRole,
  CommunityGroupType,
} from './entities/community-group.entity';

@Injectable()
export class CommunityGroupsService {
  constructor(
    @InjectRepository(CommunityGroup)
    private readonly groupRepository: Repository<CommunityGroup>,
    @InjectRepository(CommunityGroupMember)
    private readonly memberRepository: Repository<CommunityGroupMember>,
  ) {}

  async createGroup(
    userId: string,
    communityId: string,
    input: {
      name: string;
      description?: string;
      groupType?: CommunityGroupType;
      maxMembers?: number;
      weeklyGoal?: string;
    },
  ): Promise<CommunityGroup> {
    const group = await this.groupRepository.save(
      this.groupRepository.create({
        communityId,
        creatorId: userId,
        name: input.name,
        description: input.description ?? null,
        groupType: input.groupType ?? CommunityGroupType.STUDY,
        maxMembers: input.maxMembers ?? null,
        weeklyGoal: input.weeklyGoal ?? null,
      }),
    );

    await this.memberRepository.save(
      this.memberRepository.create({
        groupId: group.id,
        userId,
        role: CommunityGroupMemberRole.LEAD,
      }),
    );

    return group;
  }

  async listGroups(
    communityId: string,
    groupType?: CommunityGroupType,
  ): Promise<CommunityGroup[]> {
    const where: { communityId: string; groupType?: CommunityGroupType } = { communityId };
    if (groupType) where.groupType = groupType;
    return this.groupRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async getGroup(groupId: string): Promise<CommunityGroup> {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  async joinGroup(userId: string, groupId: string): Promise<CommunityGroupMember> {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    const existing = await this.memberRepository.findOne({ where: { groupId, userId } });
    if (existing) throw new BadRequestException('Already a member');

    if (group.maxMembers != null) {
      const count = await this.memberRepository.count({ where: { groupId } });
      if (count >= group.maxMembers) {
        throw new BadRequestException('Group is full');
      }
    }

    return this.memberRepository.save(
      this.memberRepository.create({ groupId, userId, role: CommunityGroupMemberRole.MEMBER }),
    );
  }

  async leaveGroup(userId: string, groupId: string): Promise<void> {
    const member = await this.memberRepository.findOne({ where: { groupId, userId } });
    if (!member) throw new NotFoundException('Not a member of this group');
    if (member.role === CommunityGroupMemberRole.LEAD) {
      const otherMembers = await this.memberRepository.count({
        where: { groupId },
      });
      if (otherMembers > 1) {
        throw new BadRequestException('Promote another member to lead before leaving');
      }
    }
    await this.memberRepository.delete({ id: member.id });
  }

  async listMembers(groupId: string): Promise<CommunityGroupMember[]> {
    return this.memberRepository.find({ where: { groupId }, order: { joinedAt: 'ASC' } });
  }

  async deleteGroup(userId: string, groupId: string): Promise<void> {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.creatorId !== userId) throw new ForbiddenException('Only the group creator can delete it');
    await this.memberRepository.delete({ groupId });
    await this.groupRepository.delete({ id: groupId });
  }
}
