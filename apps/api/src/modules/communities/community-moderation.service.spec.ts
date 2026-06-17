import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommunityModerationService } from './community-moderation.service';
import { CommunityReport, CommunityMemberBan } from './entities/community-moderation.entity';
import { CommunityRole, CommunityRoleType } from './entities/community-role.entity';
import { Community } from './entities/community.entity';
import { ChannelMessage } from './entities/channel-message.entity';

describe('CommunityModerationService', () => {
  let service: CommunityModerationService;
  let roleRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    delete: jest.Mock;
  };
  let banRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    delete: jest.Mock;
  };
  let communityRepository: { findOne: jest.Mock };
  let reportRepository: { save: jest.Mock; create: jest.Mock; find: jest.Mock };

  beforeEach(async () => {
    roleRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
      create: jest.fn((x) => x),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    banRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
      create: jest.fn((x) => x),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    communityRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1' }),
    };
    reportRepository = {
      save: jest.fn().mockResolvedValue({ id: 'report-1', status: 'open' }),
      create: jest.fn((x) => x),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityModerationService,
        { provide: getRepositoryToken(CommunityReport), useValue: reportRepository },
        { provide: getRepositoryToken(CommunityMemberBan), useValue: banRepository },
        { provide: getRepositoryToken(CommunityRole), useValue: roleRepository },
        { provide: getRepositoryToken(Community), useValue: communityRepository },
        { provide: getRepositoryToken(ChannelMessage), useValue: { findOne: jest.fn() } },
      ],
    }).compile();

    service = module.get(CommunityModerationService);
    jest.clearAllMocks();
    communityRepository.findOne.mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1' });
  });

  it('creates a report', async () => {
    const result = await service.reportMessage('reporter-1', {
      communityId: 'comm-1',
      channelId: 'ch-1',
      messageId: 'msg-1',
      reason: 'spam',
    });
    expect(result.id).toBe('report-1');
    expect(reportRepository.save).toHaveBeenCalled();
  });

  it('upserts role on re-assign', async () => {
    roleRepository.findOne.mockResolvedValue({
      id: 'role-1',
      communityId: 'comm-1',
      userId: 'user-2',
      role: CommunityRoleType.MODERATOR,
    });

    const result = await service.assignRole(
      'creator-1',
      'comm-1',
      'user-2',
      CommunityRoleType.ADMIN,
    );

    expect(result.role).toBe(CommunityRoleType.ADMIN);
    expect(roleRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ role: CommunityRoleType.ADMIN }),
    );
    expect(roleRepository.create).not.toHaveBeenCalled();
  });

  it('creates new role when none exists', async () => {
    roleRepository.findOne.mockResolvedValue(null);

    await service.assignRole('creator-1', 'comm-1', 'user-2', CommunityRoleType.MODERATOR);

    expect(roleRepository.create).toHaveBeenCalled();
    expect(roleRepository.save).toHaveBeenCalled();
  });

  it('upserts ban on re-ban', async () => {
    banRepository.findOne.mockResolvedValue({
      id: 'ban-1',
      communityId: 'comm-1',
      userId: 'user-bad',
    });

    await service.banMember('creator-1', 'comm-1', 'user-bad', 'repeat offender');

    expect(banRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'repeat offender' }),
    );
    expect(banRepository.create).not.toHaveBeenCalled();
  });

  it('rejects operations on unowned community', async () => {
    communityRepository.findOne.mockResolvedValue({ id: 'comm-1', creatorId: 'other-creator' });

    await expect(
      service.banMember('creator-1', 'comm-1', 'user-bad'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists roles for owned community', async () => {
    roleRepository.find.mockResolvedValue([
      { id: 'r1', userId: 'u1', role: CommunityRoleType.MODERATOR, createdAt: new Date() },
    ]);

    const roles = await service.listRoles('creator-1', 'comm-1');
    expect(roles).toHaveLength(1);
    expect(roles[0]?.role).toBe(CommunityRoleType.MODERATOR);
  });
});
