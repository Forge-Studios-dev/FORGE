import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { DataSource, In } from 'typeorm';
import { AdminService } from './admin.service';
import { User, UserRole, AdminTier } from '../users/entities/user.entity';
import {
  ModerationStatus,
  Video,
  VideoStatus,
  VideoVisibility,
} from '../content/entities/video.entity';
import { Report } from '../reports/entities/report.entity';
import { Stream } from '../streaming/entities/stream.entity';
import { Community } from '../communities/entities/community.entity';
import { CommunityReport } from '../communities/entities/community-moderation.entity';
import { CommunityRole, CommunityRoleType } from '../communities/entities/community-role.entity';
import { UsersService } from '../users/users.service';
import { PlaylistsService } from '../playlists/playlists.service';
import { AuthService } from '../auth/auth.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { VideosService } from '../content/videos.service';
import { AuthUserCacheService } from '../auth/auth-user-cache.service';
import { StreamingService } from '../streaming/streaming.service';
import { StreamLiveService } from '../streaming/stream-live.service';
import { StreamChatService } from '../stream-chat/stream-chat.service';
import { StripeConnectService } from '../billing/stripe-connect.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { OAuthAccount } from '../auth/entities/oauth-account.entity';

describe('AdminService security', () => {
  let service: AdminService;

  const userRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    save: jest.fn(async (user: User) => user),
    createQueryBuilder: jest.fn(),
  };
  const videoRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(async (video: Video) => video),
    createQueryBuilder: jest.fn(),
  };
  const reportRepository = { createQueryBuilder: jest.fn() };
  const streamRepository = { findOne: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn() };
  const communityRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(),
  };
  const communityReportRepository = { count: jest.fn() };
  const communityRoleRepository = { find: jest.fn() };
  const oauthAccountRepository = { delete: jest.fn().mockResolvedValue({ affected: 0 }) };
  const dataSource = { query: jest.fn() };
  const usersService = { getWatchHistory: jest.fn(), resolveUserId: jest.fn() };
  const playlistsService = { listByUser: jest.fn() };
  const authService = {
    logoutAll: jest.fn(),
    resendVerification: jest.fn(),
    createImpersonationToken: jest.fn(),
  };
  const authUserCache = { bust: jest.fn() };
  const analyticsService = { ingest: jest.fn() };
  const videosService = { bustVideoDetailCache: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const streamingService = { endStream: jest.fn(), grantStreamEventAccess: jest.fn() };
  const streamLiveService = { backfillMuxPlaybackIds: jest.fn() };
  const streamChatService = { getMessages: jest.fn(), deleteMessage: jest.fn() };
  const stripeConnectService = { getConnectStatus: jest.fn() };
  const entitlementsService = {
    cancelSubscriptionsForAccountDeletion: jest.fn().mockResolvedValue({ canceled: 0 }),
  };

  const regularUser: User = {
    id: 'user-1',
    email: 'user@example.com',
    username: 'userone',
    displayName: 'User One',
    role: UserRole.USER,
    isVerified: true,
    isActive: true,
    deletedAt: null,
    followerCount: 0,
    followingCount: 0,
    videoCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const adminUser: User = {
    ...regularUser,
    id: 'admin-1',
    email: 'admin@example.com',
    username: 'admin',
    displayName: 'Admin',
    role: UserRole.ADMIN,
    passwordHash: bcrypt.hashSync('correct-password', 4),
  } as User;

  const video: Video = {
    id: 'video-1',
    userId: regularUser.id,
    status: VideoStatus.READY,
    visibility: VideoVisibility.PUBLIC,
    moderationStatus: ModerationStatus.NONE,
    user: regularUser,
  } as Video;

  beforeEach(async () => {
    jest.clearAllMocks();
    userRepository.findOne.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === regularUser.id) return { ...regularUser };
      if (where.id === adminUser.id) return { ...adminUser };
      return null;
    });
    videoRepository.findOne.mockResolvedValue({ ...video });
    videoRepository.find.mockResolvedValue([]);
    videoRepository.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ raw: [] }),
    });
    streamRepository.find.mockResolvedValue([]);
    communityRepository.find.mockResolvedValue([]);
    communityRoleRepository.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Video), useValue: videoRepository },
        { provide: getRepositoryToken(Report), useValue: reportRepository },
        { provide: getRepositoryToken(Stream), useValue: streamRepository },
        { provide: getRepositoryToken(Community), useValue: communityRepository },
        { provide: getRepositoryToken(CommunityReport), useValue: communityReportRepository },
        { provide: getRepositoryToken(CommunityRole), useValue: communityRoleRepository },
        { provide: getRepositoryToken(OAuthAccount), useValue: oauthAccountRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: UsersService, useValue: usersService },
        { provide: PlaylistsService, useValue: playlistsService },
        { provide: AuthService, useValue: authService },
        { provide: AuthUserCacheService, useValue: authUserCache },
        { provide: AnalyticsService, useValue: analyticsService },
        { provide: VideosService, useValue: videosService },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: StreamingService, useValue: streamingService },
        { provide: StreamLiveService, useValue: streamLiveService },
        { provide: StreamChatService, useValue: streamChatService },
        { provide: StripeConnectService, useValue: stripeConnectService },
        { provide: EntitlementsService, useValue: entitlementsService },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  describe('deleteUser', () => {
    it('blocks deletion of platform admin accounts', async () => {
      await expect(service.deleteUser(adminUser.id)).rejects.toBeInstanceOf(BadRequestException);
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('soft-deletes user, scrubs PII, and revokes sessions', async () => {
      const result = await service.deleteUser(regularUser.id);
      expect(result).toEqual({ ok: true });
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: regularUser.id,
          isActive: false,
          isVerified: false,
          email: expect.stringContaining('deleted+'),
          username: expect.stringMatching(/^deleted_/),
          displayName: 'Deleted user',
          bio: '',
          avatarUrl: '',
          bannerUrl: '',
          websiteUrl: null,
          channelLinks: null,
          mfaSecretEncrypted: null,
          mfaBackupCodeHashes: null,
          stripeConnectAccountId: null,
        }),
      );
      expect(authService.logoutAll).toHaveBeenCalledWith(regularUser.id);
    });

    it('cancels Stripe/local memberships before anonymizing the account', async () => {
      await service.deleteUser(regularUser.id);
      expect(entitlementsService.cancelSubscriptionsForAccountDeletion).toHaveBeenCalledWith(
        regularUser.id,
      );
      expect(entitlementsService.cancelSubscriptionsForAccountDeletion.mock.invocationCallOrder[0]).toBeLessThan(
        userRepository.save.mock.invocationCallOrder[0],
      );
    });

    it('does not anonymize when membership cancel fails (billing must not orphan)', async () => {
      entitlementsService.cancelSubscriptionsForAccountDeletion.mockRejectedValueOnce(
        new Error('stripe down'),
      );
      await expect(service.deleteUser(regularUser.id)).rejects.toThrow('stripe down');
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('removes linked OAuth accounts so the real third-party email does not survive deletion', async () => {
      await service.deleteUser(regularUser.id);
      expect(oauthAccountRepository.delete).toHaveBeenCalledWith({ userId: regularUser.id });
    });

    it('hides owned public videos and ends active streams', async () => {
      videoRepository.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ raw: [{ id: 'video-1' }] }),
      });
      streamRepository.find.mockResolvedValue([{ id: 'stream-1', userId: regularUser.id }]);

      await service.deleteUser(regularUser.id);

      expect(videoRepository.createQueryBuilder).toHaveBeenCalled();
      expect(videosService.bustVideoDetailCache).toHaveBeenCalledWith('video-1');
      expect(streamingService.endStream).toHaveBeenCalledWith(regularUser.id, 'stream-1');
    });

    it('skips video/stream cleanup when the user owns none', async () => {
      await service.deleteUser(regularUser.id);
      expect(videosService.bustVideoDetailCache).not.toHaveBeenCalled();
      expect(streamingService.endStream).not.toHaveBeenCalled();
    });

    it('transfers owned-community ownership to the longest-standing OWNER-tier delegate', async () => {
      communityRepository.find.mockResolvedValue([{ id: 'comm-1', creatorId: regularUser.id }]);
      communityRoleRepository.find.mockResolvedValue([
        { userId: 'admin-delegate', role: CommunityRoleType.ADMIN, createdAt: new Date('2026-01-01') },
        { userId: 'owner-delegate-early', role: CommunityRoleType.OWNER, createdAt: new Date('2026-01-01') },
        { userId: 'owner-delegate-late', role: CommunityRoleType.OWNER, createdAt: new Date('2026-02-01') },
      ]);

      await service.deleteUser(regularUser.id);

      expect(communityRepository.update).toHaveBeenCalledWith('comm-1', {
        creatorId: 'owner-delegate-early',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'community.ownership_transferred',
        expect.objectContaining({
          communityId: 'comm-1',
          previousOwnerId: regularUser.id,
          newOwnerId: 'owner-delegate-early',
        }),
      );
    });

    it('falls back to the longest-standing ADMIN-tier delegate when there is no OWNER', async () => {
      communityRepository.find.mockResolvedValue([{ id: 'comm-1', creatorId: regularUser.id }]);
      communityRoleRepository.find.mockResolvedValue([
        { userId: 'admin-delegate', role: CommunityRoleType.ADMIN, createdAt: new Date('2026-01-01') },
        { userId: 'moderator-delegate', role: CommunityRoleType.MODERATOR, createdAt: new Date('2025-01-01') },
      ]);

      await service.deleteUser(regularUser.id);

      expect(communityRepository.update).toHaveBeenCalledWith('comm-1', {
        creatorId: 'admin-delegate',
      });
    });

    it('falls back to the longest-standing MODERATOR when there is no OWNER/ADMIN', async () => {
      communityRepository.find.mockResolvedValue([{ id: 'comm-1', creatorId: regularUser.id }]);
      communityRoleRepository.find.mockResolvedValue([
        { userId: 'moderator-delegate', role: CommunityRoleType.MODERATOR, createdAt: new Date('2026-01-01') },
        { userId: 'coach-delegate', role: CommunityRoleType.COACH, createdAt: new Date('2025-01-01') },
      ]);

      await service.deleteUser(regularUser.id);

      expect(communityRepository.update).toHaveBeenCalledWith('comm-1', {
        creatorId: 'moderator-delegate',
      });
    });

    it('privatizes the community when no OWNER/ADMIN/MODERATOR delegate exists', async () => {
      communityRepository.find.mockResolvedValue([{ id: 'comm-1', creatorId: regularUser.id }]);
      communityRoleRepository.find.mockResolvedValue([
        { userId: 'coach-delegate', role: CommunityRoleType.COACH, createdAt: new Date('2026-01-01') },
      ]);

      await service.deleteUser(regularUser.id);

      expect(communityRepository.update).toHaveBeenCalledWith('comm-1', {
        visibility: 'private',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'community.orphaned_on_owner_delete',
        expect.objectContaining({
          communityId: 'comm-1',
          previousOwnerId: regularUser.id,
        }),
      );
    });
  });

  describe('findUserById', () => {
    it('hides soft-deleted users', async () => {
      userRepository.findOne.mockResolvedValue({
        ...regularUser,
        deletedAt: new Date(),
      });
      await expect(service.findUserById(regularUser.id)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateUser', () => {
    it('busts auth cache and revokes sessions when deactivating', async () => {
      await service.updateUser(regularUser.id, { isActive: false });
      expect(userRepository.update).toHaveBeenCalledWith(regularUser.id, { isActive: false });
      expect(authUserCache.bust).toHaveBeenCalledWith(regularUser.id);
      expect(authService.logoutAll).toHaveBeenCalledWith(regularUser.id);
    });
  });

  describe('updateUser — admin escalation step-up (MED-13)', () => {
    it('blocks granting admin role without the caller current password', async () => {
      await expect(
        service.updateUser(regularUser.id, { role: UserRole.ADMIN }, adminUser.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('blocks granting admin role with the wrong password', async () => {
      await expect(
        service.updateUser(
          regularUser.id,
          { role: UserRole.ADMIN, currentAdminPassword: 'wrong-password' },
          adminUser.id,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('allows granting admin role with the correct password, and strips it from the persisted patch', async () => {
      await service.updateUser(
        regularUser.id,
        { role: UserRole.ADMIN, currentAdminPassword: 'correct-password' },
        adminUser.id,
      );
      expect(userRepository.update).toHaveBeenCalledWith(regularUser.id, { role: UserRole.ADMIN });
    });

    it('does not require a password when the target is already admin', async () => {
      await service.updateUser(adminUser.id, { role: UserRole.ADMIN, isVerified: true }, adminUser.id);
      expect(userRepository.update).toHaveBeenCalledWith(adminUser.id, {
        role: UserRole.ADMIN,
        isVerified: true,
      });
    });
  });

  describe('updateUser — adminTier', () => {
    it('allows setting adminTier on an admin account', async () => {
      await service.updateUser(adminUser.id, { adminTier: AdminTier.MODERATOR }, adminUser.id);
      expect(userRepository.update).toHaveBeenCalledWith(adminUser.id, {
        adminTier: AdminTier.MODERATOR,
      });
      expect(authUserCache.bust).toHaveBeenCalledWith(adminUser.id);
    });

    it('rejects adminTier on a non-admin account', async () => {
      await expect(
        service.updateUser(regularUser.id, { adminTier: AdminTier.MODERATOR }, adminUser.id),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('bulkUpdateUsers', () => {
    it('issues one update for all ids, busts each cache, and revokes sessions on deactivation', async () => {
      const result = await service.bulkUpdateUsers(['user-1', 'user-2'], { isActive: false });
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: In(['user-1', 'user-2']) },
        { isActive: false },
      );
      expect(authUserCache.bust).toHaveBeenCalledWith('user-1');
      expect(authUserCache.bust).toHaveBeenCalledWith('user-2');
      expect(authService.logoutAll).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ ok: true, updated: 2 });
    });

    it('no-ops on an empty id list without touching the repository', async () => {
      const result = await service.bulkUpdateUsers([], { role: UserRole.CREATOR });
      expect(userRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: true, updated: 0 });
    });
  });

  describe('bulkUpdateUsers — admin escalation step-up (MED-13)', () => {
    it('blocks a bulk grant of admin role without the caller current password', async () => {
      userRepository.find.mockResolvedValue([
        { id: 'user-1', role: UserRole.CREATOR },
        { id: 'user-2', role: UserRole.CREATOR },
      ]);
      await expect(
        service.bulkUpdateUsers(['user-1', 'user-2'], { role: UserRole.ADMIN }, adminUser.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('blocks a bulk grant of admin role with the wrong password', async () => {
      userRepository.find.mockResolvedValue([{ id: 'user-1', role: UserRole.CREATOR }]);
      await expect(
        service.bulkUpdateUsers(
          ['user-1'],
          { role: UserRole.ADMIN, currentAdminPassword: 'wrong-password' },
          adminUser.id,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('allows a bulk grant of admin role with the correct password, and strips it from the persisted patch', async () => {
      userRepository.find.mockResolvedValue([
        { id: 'user-1', role: UserRole.CREATOR },
        { id: 'user-2', role: UserRole.CREATOR },
      ]);
      await service.bulkUpdateUsers(
        ['user-1', 'user-2'],
        { role: UserRole.ADMIN, currentAdminPassword: 'correct-password' },
        adminUser.id,
      );
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: In(['user-1', 'user-2']) },
        { role: UserRole.ADMIN },
      );
    });

    it('does not require a password when every target is already admin', async () => {
      userRepository.find.mockResolvedValue([{ id: 'user-1', role: UserRole.ADMIN }]);
      await service.bulkUpdateUsers(['user-1'], { role: UserRole.ADMIN }, adminUser.id);
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: In(['user-1']) },
        { role: UserRole.ADMIN },
      );
    });
  });

  describe('bulkApproveCreators', () => {
    it('approves all ids in one update and emits a creator.approved event per id', async () => {
      const result = await service.bulkApproveCreators(['creator-1', 'creator-2']);
      expect(userRepository.update).toHaveBeenCalledTimes(1);
      expect(userRepository.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ role: UserRole.CREATOR, isVerified: true }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('creator.approved', { userId: 'creator-1' });
      expect(eventEmitter.emit).toHaveBeenCalledWith('creator.approved', { userId: 'creator-2' });
      expect(result).toEqual({ ok: true, updated: 2 });
    });
  });

  describe('bulkRejectCreators', () => {
    it('rejects all ids in one update with a shared review note', async () => {
      const result = await service.bulkRejectCreators(['creator-1'], 'Incomplete profile');
      expect(userRepository.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ creatorReviewNote: 'Incomplete profile' }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('creator.rejected', {
        userId: 'creator-1',
        note: 'Incomplete profile',
      });
      expect(result).toEqual({ ok: true, updated: 1 });
    });
  });

  describe('moderateVideo', () => {
    it('forces private visibility when moderation blocks content', async () => {
      const result = await service.moderateVideo('video-1', 'admin-1', {
        moderationStatus: ModerationStatus.BLOCKED,
        moderationNote: 'policy violation',
      });
      expect(videoRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          moderationStatus: ModerationStatus.BLOCKED,
          visibility: VideoVisibility.PRIVATE,
          moderatedBy: 'admin-1',
        }),
      );
      expect(videosService.bustVideoDetailCache).toHaveBeenCalledWith('video-1');
      expect(result.moderationStatus).toBe(ModerationStatus.BLOCKED);
    });
  });

  describe('createImpersonation', () => {
    it('creates token and records audit analytics event', async () => {
      authService.createImpersonationToken.mockResolvedValue({
        url: 'https://forgestudios.net/impersonate?token=abc',
        targetUser: { username: regularUser.username },
      });
      const result = await service.createImpersonation('admin-1', regularUser.id);
      expect(authService.createImpersonationToken).toHaveBeenCalledWith('admin-1', regularUser.id);
      expect(analyticsService.ingest).toHaveBeenCalledWith('admin-1', {
        eventName: 'admin.impersonate',
        properties: { targetUserId: regularUser.id, targetUsername: regularUser.username },
      });
      expect(result.url).toContain('impersonate');
    });
  });

  describe('stream chat moderation', () => {
    it('requires ADMIN role to read stream chat', async () => {
      await expect(
        service.getStreamChat('stream-1', 'user-1', UserRole.USER, 50),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(streamChatService.getMessages).not.toHaveBeenCalled();
    });

    it('allows ADMIN to read stream chat', async () => {
      streamChatService.getMessages.mockResolvedValue([{ id: 'msg-1' }]);
      await service.getStreamChat('stream-1', 'admin-1', UserRole.ADMIN, 50);
      expect(streamChatService.getMessages).toHaveBeenCalledWith(
        'stream-1',
        50,
        undefined,
        'admin-1',
        UserRole.ADMIN,
      );
    });

    it('requires ADMIN role to delete stream chat messages', async () => {
      await expect(
        service.deleteStreamChatMessage('stream-1', 'msg-1', 'user-1', UserRole.CREATOR),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(streamChatService.deleteMessage).not.toHaveBeenCalled();
    });
  });

  describe('listStreams', () => {
    it('orders by the entity property name, not the raw DB column — TypeORM QueryBuilder resolves alias.property paths against entity metadata, not SQL column names', async () => {
      const qb: {
        leftJoinAndSelect: jest.Mock;
        orderBy: jest.Mock;
        andWhere: jest.Mock;
        skip: jest.Mock;
        take: jest.Mock;
        getManyAndCount: jest.Mock;
      } = {
        leftJoinAndSelect: jest.fn(),
        orderBy: jest.fn(),
        andWhere: jest.fn(),
        skip: jest.fn(),
        take: jest.fn(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      qb.leftJoinAndSelect.mockReturnValue(qb);
      qb.orderBy.mockReturnValue(qb);
      qb.andWhere.mockReturnValue(qb);
      qb.skip.mockReturnValue(qb);
      qb.take.mockReturnValue(qb);
      streamRepository.createQueryBuilder.mockReturnValue(qb);

      await service.listStreams({});

      expect(qb.orderBy).toHaveBeenCalledWith('s.createdAt', 'DESC');
    });
  });
});
