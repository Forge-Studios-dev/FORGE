import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PlaylistsService } from '../playlists/playlists.service';
import { EngagementService } from '../engagement/engagement.service';
import { AdminService } from '../admin/admin.service';
import { AuthService } from '../auth/auth.service';
import { UserRole } from './entities/user.entity';

describe('UsersController self-service account actions', () => {
  let controller: UsersController;

  const passwordHash = bcrypt.hashSync('correct-password', 4);
  const profile = {
    id: 'user-1',
    email: 'userone@forge.local',
    username: 'userone',
    displayName: 'User One',
    role: UserRole.USER,
    passwordHash,
  };

  const usersService = {
    findById: jest.fn().mockResolvedValue(profile),
    findByUsername: jest.fn().mockResolvedValue(profile),
    exportOwnedVideos: jest.fn().mockResolvedValue([]),
    getWatchHistory: jest.fn().mockResolvedValue([]),
  };
  const playlistsService = { listByUser: jest.fn().mockResolvedValue([]) };
  const engagementService = {
    hasBlocked: jest.fn().mockResolvedValue(false),
    isBlockedEitherWay: jest.fn().mockResolvedValue(false),
    isFollowing: jest.fn().mockResolvedValue(false),
  };
  const adminService = { deleteUser: jest.fn().mockResolvedValue({ ok: true }) };
  const authService = {
    verifyAccountDeletionToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    usersService.findById.mockResolvedValue(profile);
    usersService.findByUsername.mockResolvedValue(profile);
    engagementService.hasBlocked.mockResolvedValue(false);
    engagementService.isBlockedEitherWay.mockResolvedValue(false);
    engagementService.isFollowing.mockResolvedValue(false);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: PlaylistsService, useValue: playlistsService },
        { provide: EngagementService, useValue: engagementService },
        { provide: AdminService, useValue: adminService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    controller = module.get(UsersController);
  });

  describe('deleteMyAccount', () => {
    it('rejects an incorrect current password', async () => {
      await expect(
        controller.deleteMyAccount({ sub: 'user-1' } as any, {
          currentPassword: 'wrong-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(adminService.deleteUser).not.toHaveBeenCalled();
    });

    it('deletes the account when the current password matches', async () => {
      const result = await controller.deleteMyAccount({ sub: 'user-1' } as any, {
        currentPassword: 'correct-password',
      });
      expect(result).toEqual({ ok: true });
      expect(adminService.deleteUser).toHaveBeenCalledWith('user-1');
    });

    it('deletes the account via a valid confirmationToken (Google-OAuth-only path)', async () => {
      const result = await controller.deleteMyAccount({ sub: 'user-1' } as any, {
        confirmationToken: 'tok-1',
      });
      expect(authService.verifyAccountDeletionToken).toHaveBeenCalledWith('tok-1', 'user-1');
      expect(result).toEqual({ ok: true });
      expect(adminService.deleteUser).toHaveBeenCalledWith('user-1');
    });

    it('rejects an invalid confirmationToken without deleting', async () => {
      authService.verifyAccountDeletionToken.mockImplementationOnce(() => {
        throw new UnauthorizedException('Invalid deletion confirmation token');
      });
      await expect(
        controller.deleteMyAccount({ sub: 'user-1' } as any, { confirmationToken: 'bad' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(adminService.deleteUser).not.toHaveBeenCalled();
    });

    it('rejects when neither currentPassword nor confirmationToken is provided', async () => {
      await expect(
        controller.deleteMyAccount({ sub: 'user-1' } as any, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(adminService.deleteUser).not.toHaveBeenCalled();
    });
  });

  describe('exportMyData', () => {
    it('aggregates profile, videos, watch history, and playlists', async () => {
      const result = await controller.exportMyData({ sub: 'user-1' } as any);
      expect(result.profile.id).toBe('user-1');
      expect(result.videos).toEqual([]);
      expect(result.watchHistory).toEqual([]);
      expect(result.playlists).toEqual([]);
      expect(usersService.exportOwnedVideos).toHaveBeenCalledWith('user-1');
      expect(playlistsService.listByUser).toHaveBeenCalledWith('user-1', 'user-1');
    });
  });

  // These two routes are @Public() — reachable by anonymous visitors — and
  // previously leaked `email` to any viewer via toPublicUser's full shape.
  describe('channel page privacy (findByUsername / findById)', () => {
    it('findByUsername omits email for an anonymous viewer', async () => {
      const result = await controller.findByUsername('userone', undefined);
      expect(result).not.toHaveProperty('email');
      expect(result.username).toBe('userone');
    });

    it('findByUsername omits email for a different signed-in viewer', async () => {
      const result = await controller.findByUsername('userone', { sub: 'viewer-2' } as any);
      expect(result).not.toHaveProperty('email');
    });

    it('findByUsername includes email when the viewer is the profile owner', async () => {
      const result = await controller.findByUsername('userone', { sub: 'user-1' } as any);
      expect((result as { email?: string }).email).toBe('userone@forge.local');
    });

    it('findById omits email for a different signed-in viewer', async () => {
      const result = await controller.findById('user-1', { sub: 'viewer-2' } as any);
      expect(result).not.toHaveProperty('email');
    });

    it('findById includes email when the viewer is the profile owner', async () => {
      const result = await controller.findById('user-1', { sub: 'user-1' } as any);
      expect((result as { email?: string }).email).toBe('userone@forge.local');
    });
  });
});
