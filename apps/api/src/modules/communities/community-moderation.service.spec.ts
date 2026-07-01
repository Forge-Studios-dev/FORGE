import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommunityModerationService } from './community-moderation.service';
import { CommunityReport, CommunityMemberBan } from './entities/community-moderation.entity';
import { CommunityRole, CommunityRoleType } from './entities/community-role.entity';
import { Community } from './entities/community.entity';
import { Channel } from './entities/channel.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import { CommunityPost } from './entities/community-post.entity';
import { CommunityPoll } from './entities/community-poll.entity';
import { CommunityRoom } from './entities/community-room.entity';
import { CommunityRoomMessage } from './entities/community-room-message.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CommunitiesService } from './communities.service';
import { CreatorAuditService } from './creator-audit.service';

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
  let channelRepository: { findOne: jest.Mock };
  let messageRepository: { findOne: jest.Mock };
  let postRepository: { findOne: jest.Mock };
  let pollRepository: { findOne: jest.Mock };
  let roomRepository: { findOne: jest.Mock };
  let roomMessageRepository: { findOne: jest.Mock };
  let reportRepository: {
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };

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
    channelRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'ch-1', communityId: 'comm-1' }),
    };
    messageRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'msg-1', channelId: 'ch-1' }),
    };
    postRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'post-1', communityId: 'comm-1' }),
    };
    pollRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'poll-1', communityId: 'comm-1' }),
    };
    roomRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'room-1', communityId: 'comm-1' }),
    };
    roomMessageRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'rmsg-1', roomId: 'room-1' }),
    };
    reportRepository = {
      save: jest.fn().mockResolvedValue({ id: 'report-1', status: 'open' }),
      create: jest.fn((x) => x),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({
        id: 'report-1',
        communityId: 'comm-1',
        status: 'open',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityModerationService,
        { provide: getRepositoryToken(CommunityReport), useValue: reportRepository },
        { provide: getRepositoryToken(CommunityMemberBan), useValue: banRepository },
        { provide: getRepositoryToken(CommunityRole), useValue: roleRepository },
        { provide: getRepositoryToken(Community), useValue: communityRepository },
        { provide: getRepositoryToken(Channel), useValue: channelRepository },
        { provide: getRepositoryToken(ChannelMessage), useValue: messageRepository },
        { provide: getRepositoryToken(CommunityPost), useValue: postRepository },
        { provide: getRepositoryToken(CommunityPoll), useValue: pollRepository },
        { provide: getRepositoryToken(CommunityRoom), useValue: roomRepository },
        { provide: getRepositoryToken(CommunityRoomMessage), useValue: roomMessageRepository },
        {
          provide: NotificationsService,
          useValue: { create: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: CommunitiesService,
          useValue: { assertCommunityAccess: jest.fn().mockResolvedValue({ id: 'comm-1' }) },
        },
        {
          provide: CreatorAuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
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

  it('creates a post report', async () => {
    const result = await service.createReport('reporter-1', {
      communityId: 'comm-1',
      targetType: 'post',
      postId: 'post-1',
      reason: 'misleading',
    });
    expect(result.id).toBe('report-1');
    expect(postRepository.findOne).toHaveBeenCalled();
  });

  it('rejects report when channel is not in community', async () => {
    channelRepository.findOne.mockResolvedValue(null);
    await expect(
      service.reportMessage('reporter-1', {
        communityId: 'comm-1',
        channelId: 'bad-ch',
        messageId: 'msg-1',
        reason: 'spam',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects report when message is not in channel', async () => {
    messageRepository.findOne.mockResolvedValue(null);
    await expect(
      service.reportMessage('reporter-1', {
        communityId: 'comm-1',
        channelId: 'ch-1',
        messageId: 'bad-msg',
        reason: 'spam',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  it('allows delegated moderators to ban members', async () => {
    communityRepository.findOne.mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1' });
    roleRepository.findOne.mockResolvedValue({
      communityId: 'comm-1',
      userId: 'mod-1',
      role: CommunityRoleType.MODERATOR,
    });
    banRepository.findOne.mockResolvedValue(null);

    const result = await service.banMember('mod-1', 'comm-1', 'user-bad', 'spam');

    expect(result.banned).toBe(true);
    expect(banRepository.save).toHaveBeenCalled();
  });

  it('rejects ban from users without moderator privileges', async () => {
    communityRepository.findOne.mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1' });
    roleRepository.findOne.mockResolvedValue(null);

    await expect(service.banMember('random-user', 'comm-1', 'user-bad')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lists roles for owned community', async () => {
    roleRepository.find.mockResolvedValue([
      { id: 'r1', userId: 'u1', role: CommunityRoleType.MODERATOR, createdAt: new Date() },
    ]);

    const roles = await service.listRoles('creator-1', 'comm-1');
    expect(roles).toHaveLength(1);
    expect(roles[0]?.role).toBe(CommunityRoleType.MODERATOR);
  });

  it('resolves a report for community moderators', async () => {
    const result = await service.resolveReportForCommunity('creator-1', 'comm-1', 'report-1');
    expect(result.resolved).toBe(true);
    expect(reportRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'resolved' }),
    );
  });

  it('allows coaches to list reports', async () => {
    roleRepository.findOne.mockResolvedValue({
      communityId: 'comm-1',
      userId: 'coach-1',
      role: CommunityRoleType.COACH,
    });

    await service.listReportsForCommunity('coach-1', 'comm-1');
    expect(reportRepository.find).toHaveBeenCalled();
  });

  it('rejects coaches from banning members', async () => {
    roleRepository.findOne.mockResolvedValue({
      communityId: 'comm-1',
      userId: 'coach-1',
      role: CommunityRoleType.COACH,
    });

    await expect(service.banMember('coach-1', 'comm-1', 'user-bad')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
