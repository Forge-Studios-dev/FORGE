import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PlaylistsService } from '../playlists/playlists.service';
import { EngagementService } from '../engagement/engagement.service';
import { AdminService } from '../admin/admin.service';
import { UserRole } from './entities/user.entity';

describe('UsersController self-service account actions', () => {
  let controller: UsersController;

  const passwordHash = bcrypt.hashSync('correct-password', 4);
  const profile = {
    id: 'user-1',
    username: 'userone',
    displayName: 'User One',
    role: UserRole.USER,
    passwordHash,
  };

  const usersService = {
    findById: jest.fn().mockResolvedValue(profile),
    exportOwnedVideos: jest.fn().mockResolvedValue([]),
    getWatchHistory: jest.fn().mockResolvedValue([]),
  };
  const playlistsService = { listByUser: jest.fn().mockResolvedValue([]) };
  const engagementService = {};
  const adminService = { deleteUser: jest.fn().mockResolvedValue({ ok: true }) };

  beforeEach(async () => {
    jest.clearAllMocks();
    usersService.findById.mockResolvedValue(profile);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: PlaylistsService, useValue: playlistsService },
        { provide: EngagementService, useValue: engagementService },
        { provide: AdminService, useValue: adminService },
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
});
