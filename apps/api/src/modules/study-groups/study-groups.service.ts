import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  StudyGroup,
  StudyGroupCheckIn,
  StudyGroupCheckInStatus,
  StudyGroupMember,
  StudyGroupMemberRole,
  StudyGroupMemberStatus,
  StudyGroupType,
} from './entities/study-group.entity';
import { clampLimit, clampPage } from '../../common/utils/pagination.util';

const MAX_NAME_LENGTH = 200;
const MAX_NOTE_LENGTH = 1000;
const MAX_GROUPS_OWNED_PER_USER = 20;

@Injectable()
export class StudyGroupsService {
  constructor(
    @InjectRepository(StudyGroup)
    private readonly groupRepository: Repository<StudyGroup>,
    @InjectRepository(StudyGroupMember)
    private readonly memberRepository: Repository<StudyGroupMember>,
    @InjectRepository(StudyGroupCheckIn)
    private readonly checkInRepository: Repository<StudyGroupCheckIn>,
  ) {}

  async createGroup(
    ownerId: string,
    input: {
      groupType: StudyGroupType;
      name: string;
      description?: string;
      topic?: string;
      courseId?: string;
      maxMembers?: number;
      isPrivate?: boolean;
    },
  ): Promise<StudyGroup> {
    if (!input.name.trim()) throw new BadRequestException('Name is required');
    if (!Object.values(StudyGroupType).includes(input.groupType)) {
      throw new BadRequestException('Invalid group type');
    }

    const ownedCount = await this.groupRepository.count({ where: { ownerId } });
    if (ownedCount >= MAX_GROUPS_OWNED_PER_USER) {
      throw new BadRequestException(`Maximum ${MAX_GROUPS_OWNED_PER_USER} groups per owner`);
    }

    const group = await this.groupRepository.save(
      this.groupRepository.create({
        ownerId,
        groupType: input.groupType,
        name: input.name.trim().slice(0, MAX_NAME_LENGTH),
        description: input.description?.trim() || null,
        topic: input.topic?.trim() || null,
        courseId: input.courseId ?? null,
        maxMembers: input.maxMembers ?? null,
        isPrivate: input.isPrivate ?? false,
      }),
    );

    await this.memberRepository.save(
      this.memberRepository.create({
        groupId: group.id,
        userId: ownerId,
        role: StudyGroupMemberRole.OWNER,
        status: StudyGroupMemberStatus.ACTIVE,
      }),
    );

    return group;
  }

  async updateGroup(
    ownerId: string,
    groupId: string,
    input: Partial<{
      name: string;
      description: string | null;
      topic: string | null;
      maxMembers: number | null;
      isPrivate: boolean;
    }>,
  ): Promise<StudyGroup> {
    const group = await this.findOwned(ownerId, groupId);
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException('Name is required');
      group.name = name.slice(0, MAX_NAME_LENGTH);
    }
    if (input.description !== undefined) group.description = input.description?.trim() || null;
    if (input.topic !== undefined) group.topic = input.topic?.trim() || null;
    if (input.maxMembers !== undefined) group.maxMembers = input.maxMembers;
    if (input.isPrivate !== undefined) group.isPrivate = input.isPrivate;
    return this.groupRepository.save(group);
  }

  async deleteGroup(ownerId: string, groupId: string): Promise<{ success: true }> {
    const group = await this.findOwned(ownerId, groupId);
    await this.groupRepository.remove(group);
    return { success: true };
  }

  async listPublicGroups(opts: {
    groupType?: StudyGroupType;
    page?: unknown;
    limit?: unknown;
  }): Promise<{ data: StudyGroup[] }> {
    const take = clampLimit(opts.limit);
    const skip = (clampPage(opts.page) - 1) * take;
    const data = await this.groupRepository.find({
      where: { isPrivate: false, ...(opts.groupType ? { groupType: opts.groupType } : {}) },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
    return { data };
  }

  async getGroup(groupId: string, viewerId?: string): Promise<StudyGroup & { viewerStatus: StudyGroupMemberStatus | null }> {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    let viewerStatus: StudyGroupMemberStatus | null = null;
    if (viewerId) {
      const membership = await this.memberRepository.findOne({ where: { groupId, userId: viewerId } });
      viewerStatus = membership?.status ?? null;
    }
    return { ...group, viewerStatus };
  }

  async joinGroup(
    userId: string,
    groupId: string,
  ): Promise<{ status: StudyGroupMemberStatus }> {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    const existing = await this.memberRepository.findOne({ where: { groupId, userId } });
    if (existing) return { status: existing.status };

    if (group.maxMembers != null) {
      const activeCount = await this.memberRepository.count({
        where: { groupId, status: StudyGroupMemberStatus.ACTIVE },
      });
      if (activeCount >= group.maxMembers) {
        throw new BadRequestException('This group is full');
      }
    }

    const status = group.isPrivate ? StudyGroupMemberStatus.PENDING : StudyGroupMemberStatus.ACTIVE;
    await this.memberRepository.save(
      this.memberRepository.create({
        groupId,
        userId,
        role: StudyGroupMemberRole.MEMBER,
        status,
      }),
    );
    return { status };
  }

  async leaveGroup(userId: string, groupId: string): Promise<{ success: true }> {
    const membership = await this.memberRepository.findOne({ where: { groupId, userId } });
    if (!membership) throw new NotFoundException('You are not a member of this group');
    if (membership.role === StudyGroupMemberRole.OWNER) {
      throw new BadRequestException('The owner cannot leave — delete the group instead');
    }
    await this.memberRepository.remove(membership);
    return { success: true };
  }

  async approveMember(ownerId: string, groupId: string, userId: string): Promise<{ success: true }> {
    await this.findOwned(ownerId, groupId);
    const membership = await this.memberRepository.findOne({ where: { groupId, userId } });
    if (!membership) throw new NotFoundException('Join request not found');
    membership.status = StudyGroupMemberStatus.ACTIVE;
    await this.memberRepository.save(membership);
    return { success: true };
  }

  async removeMember(ownerId: string, groupId: string, userId: string): Promise<{ success: true }> {
    await this.findOwned(ownerId, groupId);
    if (userId === ownerId) throw new BadRequestException('The owner cannot be removed');
    const membership = await this.memberRepository.findOne({ where: { groupId, userId } });
    if (!membership) throw new NotFoundException('Member not found');
    await this.memberRepository.remove(membership);
    return { success: true };
  }

  async listMembers(groupId: string, viewerId?: string): Promise<{ data: StudyGroupMember[] }> {
    const group = await this.groupRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.isPrivate) {
      await this.assertActiveMember(groupId, viewerId);
    }
    const data = await this.memberRepository.find({
      where: { groupId, status: StudyGroupMemberStatus.ACTIVE },
      order: { joinedAt: 'ASC' },
    });
    return { data };
  }

  async submitCheckIn(
    userId: string,
    groupId: string,
    input: { status?: StudyGroupCheckInStatus; note?: string },
  ): Promise<StudyGroupCheckIn> {
    const membership = await this.assertActiveMember(groupId, userId);
    const status = input.status ?? StudyGroupCheckInStatus.DONE;

    const checkIn = await this.checkInRepository.save(
      this.checkInRepository.create({
        groupId,
        userId,
        status,
        note: input.note?.trim().slice(0, MAX_NOTE_LENGTH) || null,
      }),
    );

    membership.lastCheckInAt = checkIn.createdAt;
    membership.streakCount = status === StudyGroupCheckInStatus.DONE ? membership.streakCount + 1 : 0;
    await this.memberRepository.save(membership);

    return checkIn;
  }

  async listCheckIns(
    groupId: string,
    viewerId: string | undefined,
    opts: { page?: unknown; limit?: unknown } = {},
  ): Promise<{ data: StudyGroupCheckIn[] }> {
    await this.assertActiveMember(groupId, viewerId);
    const take = clampLimit(opts.limit);
    const skip = (clampPage(opts.page) - 1) * take;
    const data = await this.checkInRepository.find({
      where: { groupId },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
    return { data };
  }

  private async findOwned(ownerId: string, groupId: string): Promise<StudyGroup> {
    const group = await this.groupRepository.findOne({ where: { id: groupId, ownerId } });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  private async assertActiveMember(
    groupId: string,
    userId?: string,
  ): Promise<StudyGroupMember> {
    if (!userId) throw new ForbiddenException('Membership required');
    const membership = await this.memberRepository.findOne({
      where: { groupId, userId, status: StudyGroupMemberStatus.ACTIVE },
    });
    if (!membership) throw new ForbiddenException('You must be an active member of this group');
    return membership;
  }
}
