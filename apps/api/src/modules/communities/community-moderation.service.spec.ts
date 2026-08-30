import { BadRequestException, ForbiddenException, HttpException } from '@nestjs/common';
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
import { TRUSTED_DAILY_REPORT_CAP } from '../reports/reporter-trust.util';

describe('CommunityModerationService', () => {
  let service: CommunityModerationService;
  let communitiesService: { assertCommunityAccess: jest.Mock };
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
  let communityRepository: { findOne: jest.Mock; find: jest.Mock };
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
    count: jest.Mock;
    createQueryBuilder: jest.Mock;
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
      find: jest.fn().mockResolvedValue([]),
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
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue({
        id: 'report-1',
        communityId: 'comm-1',
        status: 'open',
      }),
      createQueryBuilder: jest.fn(),
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
    communitiesService = module.get(CommunitiesService);
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

  it('skips block gate when creating a community report', async () => {
    await service.createReport('reporter-1', {
      communityId: 'comm-1',
      targetType: 'user',
      reportedUserId: 'user-2',
      reason: 'harassment',
    });
    expect(communitiesService.assertCommunityAccess).toHaveBeenCalledWith(
      'comm-1',
      'reporter-1',
      undefined,
      { skipBlockGate: true },
    );
  });

  it('rejects reports over the daily cap', async () => {
    reportRepository.count.mockResolvedValue(TRUSTED_DAILY_REPORT_CAP);
    await expect(
      service.createReport('reporter-1', {
        communityId: 'comm-1',
        targetType: 'post',
        postId: 'post-1',
        reason: 'spam',
      }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(reportRepository.save).not.toHaveBeenCalled();
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

  it('blocks a delegated ADMIN from assigning the OWNER role (privilege escalation)', async () => {
    roleRepository.findOne.mockImplementation(async ({ where }: { where: { userId: string } }) =>
      where.userId === 'admin-actor' ? { role: CommunityRoleType.ADMIN } : null,
    );

    await expect(
      service.assignRole('admin-actor', 'comm-1', 'user-2', CommunityRoleType.OWNER),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(roleRepository.save).not.toHaveBeenCalled();
  });

  it('blocks a delegated ADMIN from assigning the ADMIN role (privilege escalation)', async () => {
    roleRepository.findOne.mockImplementation(async ({ where }: { where: { userId: string } }) =>
      where.userId === 'admin-actor' ? { role: CommunityRoleType.ADMIN } : null,
    );

    await expect(
      service.assignRole('admin-actor', 'comm-1', 'user-2', CommunityRoleType.ADMIN),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('still allows a delegated ADMIN to assign lower-tier roles', async () => {
    roleRepository.findOne.mockImplementation(async ({ where }: { where: { userId: string } }) =>
      where.userId === 'admin-actor' ? { role: CommunityRoleType.ADMIN } : null,
    );

    await service.assignRole('admin-actor', 'comm-1', 'user-2', CommunityRoleType.MODERATOR);

    expect(roleRepository.save).toHaveBeenCalled();
  });

  it('allows the true OWNER to assign the ADMIN role', async () => {
    roleRepository.findOne.mockImplementation(async ({ where }: { where: { userId: string } }) =>
      where.userId === 'owner-actor' ? { role: CommunityRoleType.OWNER } : null,
    );

    await service.assignRole('owner-actor', 'comm-1', 'user-2', CommunityRoleType.ADMIN);

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

  describe('listUnifiedReportsForCreator', () => {
    function mockQb(rows: Array<Record<string, unknown>>) {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
      reportRepository.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it('returns empty meta when creator has no communities', async () => {
      communityRepository.find.mockResolvedValue([]);
      roleRepository.find.mockResolvedValue([]);

      const result = await service.listUnifiedReportsForCreator('creator-1', 'open');

      expect(result).toEqual({
        data: [],
        meta: { cursor: null, hasMore: false, total: 0 },
      });
      expect(reportRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('cursor-paginates and reports total open count', async () => {
      communityRepository.find.mockResolvedValue([
        { id: 'comm-1', name: 'Main', slug: 'main' },
      ]);
      roleRepository.find.mockResolvedValue([]);
      const older = new Date('2026-08-01T10:00:00.000Z');
      const newer = new Date('2026-08-02T10:00:00.000Z');
      const qb = mockQb([
        {
          id: 'r2',
          communityId: 'comm-1',
          reason: 'Spam',
          status: 'open',
          createdAt: newer,
        },
        {
          id: 'r1',
          communityId: 'comm-1',
          reason: 'Hate',
          status: 'open',
          createdAt: older,
        },
      ]);
      reportRepository.count.mockResolvedValue(5);

      const result = await service.listUnifiedReportsForCreator('creator-1', 'open', {
        limit: 1,
      });

      expect(qb.take).toHaveBeenCalledWith(2);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'r2',
        communityName: 'Main',
      });
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.total).toBe(5);
      expect(result.meta.cursor).toBe(
        Buffer.from(`${newer.toISOString()}|r2`).toString('base64'),
      );
    });

    it('applies cursor filter on subsequent pages', async () => {
      communityRepository.find.mockResolvedValue([
        { id: 'comm-1', name: 'Main', slug: 'main' },
      ]);
      roleRepository.find.mockResolvedValue([]);
      const qb = mockQb([]);
      reportRepository.count.mockResolvedValue(0);
      const cursor = Buffer.from('2026-08-02T10:00:00.000Z|r2').toString('base64');

      await service.listUnifiedReportsForCreator('creator-1', 'open', { cursor, limit: 30 });

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(r.createdAt < :cursorAt OR (r.createdAt = :cursorAt AND r.id < :cursorId))',
        {
          cursorAt: new Date('2026-08-02T10:00:00.000Z'),
          cursorId: 'r2',
        },
      );
    });
  });
});
