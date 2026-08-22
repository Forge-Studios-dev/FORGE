import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StudyGroupsService } from './study-groups.service';
import {
  StudyGroup,
  StudyGroupCheckIn,
  StudyGroupCheckInStatus,
  StudyGroupMember,
  StudyGroupMemberRole,
  StudyGroupMemberStatus,
  StudyGroupType,
} from './entities/study-group.entity';

describe('StudyGroupsService', () => {
  let service: StudyGroupsService;

  const mockGroup: Partial<StudyGroup> = {
    id: 'group-1',
    ownerId: 'owner-1',
    groupType: StudyGroupType.STUDY,
    name: 'React Study Group',
    description: null,
    topic: 'React',
    courseId: null,
    maxMembers: null,
    isPrivate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOwnerMembership: Partial<StudyGroupMember> = {
    id: 'member-owner',
    groupId: 'group-1',
    userId: 'owner-1',
    role: StudyGroupMemberRole.OWNER,
    status: StudyGroupMemberStatus.ACTIVE,
    streakCount: 0,
    lastCheckInAt: null,
    joinedAt: new Date(),
  };

  const groupRepository = {
    count: jest.fn().mockResolvedValue(0),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([mockGroup]),
    save: jest.fn(async (entity: Partial<StudyGroup>) => ({ ...mockGroup, ...entity })),
    create: jest.fn((dto: Partial<StudyGroup>) => dto),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const memberRepository = {
    count: jest.fn().mockResolvedValue(0),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([mockOwnerMembership]),
    save: jest.fn(async (entity: Partial<StudyGroupMember>) => ({ ...mockOwnerMembership, ...entity })),
    create: jest.fn((dto: Partial<StudyGroupMember>) => dto),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const checkInRepository = {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (entity: Partial<StudyGroupCheckIn>) => ({
      id: 'checkin-1',
      createdAt: new Date(),
      ...entity,
    })),
    create: jest.fn((dto: Partial<StudyGroupCheckIn>) => dto),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    groupRepository.count.mockResolvedValue(0);
    groupRepository.find.mockResolvedValue([mockGroup]);
    memberRepository.count.mockResolvedValue(0);
    memberRepository.find.mockResolvedValue([mockOwnerMembership]);
    checkInRepository.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudyGroupsService,
        { provide: getRepositoryToken(StudyGroup), useValue: groupRepository },
        { provide: getRepositoryToken(StudyGroupMember), useValue: memberRepository },
        { provide: getRepositoryToken(StudyGroupCheckIn), useValue: checkInRepository },
      ],
    }).compile();

    service = module.get(StudyGroupsService);
  });

  describe('createGroup', () => {
    it('rejects an empty name', async () => {
      await expect(
        service.createGroup('owner-1', { groupType: StudyGroupType.STUDY, name: '  ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a group and adds the owner as an active member', async () => {
      const result = await service.createGroup('owner-1', {
        groupType: StudyGroupType.ACCOUNTABILITY,
        name: 'Habit Pod',
      });
      expect(result.name).toBe('Habit Pod');
      expect(memberRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: StudyGroupMemberRole.OWNER, status: StudyGroupMemberStatus.ACTIVE }),
      );
    });

    it('enforces the max-owned-groups cap', async () => {
      groupRepository.count.mockResolvedValue(20);
      await expect(
        service.createGroup('owner-1', { groupType: StudyGroupType.STUDY, name: 'Group' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('joinGroup', () => {
    it('joins a public group immediately', async () => {
      groupRepository.findOne.mockResolvedValue({ ...mockGroup, isPrivate: false });
      memberRepository.findOne.mockResolvedValue(null);
      const result = await service.joinGroup('viewer-1', 'group-1');
      expect(result.status).toBe(StudyGroupMemberStatus.ACTIVE);
    });

    it('creates a pending membership for a private group', async () => {
      groupRepository.findOne.mockResolvedValue({ ...mockGroup, isPrivate: true });
      memberRepository.findOne.mockResolvedValue(null);
      const result = await service.joinGroup('viewer-1', 'group-1');
      expect(result.status).toBe(StudyGroupMemberStatus.PENDING);
    });

    it('is idempotent for an existing member', async () => {
      groupRepository.findOne.mockResolvedValue({ ...mockGroup });
      memberRepository.findOne.mockResolvedValue({ ...mockOwnerMembership, userId: 'viewer-1' });
      const result = await service.joinGroup('viewer-1', 'group-1');
      expect(result.status).toBe(StudyGroupMemberStatus.ACTIVE);
      expect(memberRepository.save).not.toHaveBeenCalled();
    });

    it('rejects joining a full group', async () => {
      groupRepository.findOne.mockResolvedValue({ ...mockGroup, maxMembers: 1 });
      memberRepository.findOne.mockResolvedValue(null);
      memberRepository.count.mockResolvedValue(1);
      await expect(service.joinGroup('viewer-1', 'group-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('leaveGroup', () => {
    it('refuses to let the owner leave', async () => {
      memberRepository.findOne.mockResolvedValue({ ...mockOwnerMembership });
      await expect(service.leaveGroup('owner-1', 'group-1')).rejects.toThrow(BadRequestException);
    });

    it('removes a regular member', async () => {
      memberRepository.findOne.mockResolvedValue({
        ...mockOwnerMembership,
        userId: 'viewer-1',
        role: StudyGroupMemberRole.MEMBER,
      });
      const result = await service.leaveGroup('viewer-1', 'group-1');
      expect(result.success).toBe(true);
    });
  });

  describe('submitCheckIn', () => {
    it('requires active membership', async () => {
      memberRepository.findOne.mockResolvedValue(null);
      await expect(
        service.submitCheckIn('viewer-1', 'group-1', {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('increments streak on a DONE check-in', async () => {
      memberRepository.findOne.mockResolvedValue({ ...mockOwnerMembership, streakCount: 2 });
      await service.submitCheckIn('owner-1', 'group-1', { status: StudyGroupCheckInStatus.DONE });
      expect(memberRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ streakCount: 3 }),
      );
    });

    it('resets streak on a MISSED check-in', async () => {
      memberRepository.findOne.mockResolvedValue({ ...mockOwnerMembership, streakCount: 5 });
      await service.submitCheckIn('owner-1', 'group-1', { status: StudyGroupCheckInStatus.MISSED });
      expect(memberRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ streakCount: 0 }),
      );
    });
  });

  describe('approveMember / removeMember', () => {
    it('throws when the caller does not own the group', async () => {
      groupRepository.findOne.mockResolvedValue(null);
      await expect(
        service.approveMember('not-owner', 'group-1', 'viewer-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses to remove the owner', async () => {
      groupRepository.findOne.mockResolvedValue({ ...mockGroup });
      await expect(service.removeMember('owner-1', 'group-1', 'owner-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
