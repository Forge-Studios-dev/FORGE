import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlaylistsService } from './playlists.service';
import { Playlist, PlaylistSystemType, PlaylistVisibility } from './entities/playlist.entity';
import { PlaylistVideo } from './entities/playlist-video.entity';
import { Video } from '../content/entities/video.entity';
import { Like } from '../engagement/entities/like.entity';

describe('PlaylistsService', () => {
  let service: PlaylistsService;

  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const playlistRepository = {
    create: jest.fn((dto: Partial<Playlist>) => dto),
    save: jest.fn(async (dto: Partial<Playlist>) => ({ id: 'pl-1', ...dto })),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  };
  const playlistVideoRepository = {
    create: jest.fn((dto: Partial<PlaylistVideo>) => dto),
    save: jest.fn(async (dto: Partial<PlaylistVideo>) => ({ id: 'pv-1', ...dto })),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ playlistId: 'pl-1' }]),
      getRawOne: jest.fn().mockResolvedValue({ max: '-1' }),
    })),
  };
  const videoRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    decrement: jest.fn().mockResolvedValue(undefined),
  };
  const likeRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const ownerId = 'user-1';
  const otherId = 'user-2';

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaylistsService,
        { provide: getRepositoryToken(Playlist), useValue: playlistRepository },
        { provide: getRepositoryToken(PlaylistVideo), useValue: playlistVideoRepository },
        { provide: getRepositoryToken(Video), useValue: videoRepository },
        { provide: getRepositoryToken(Like), useValue: likeRepository },
      ],
    }).compile();
    service = module.get(PlaylistsService);
  });

  describe('create', () => {
    it('creates a playlist defaulting to public visibility', async () => {
      const result = await service.create(ownerId, 'My list');
      expect(playlistRepository.create).toHaveBeenCalledWith({
        userId: ownerId,
        title: 'My list',
        visibility: PlaylistVisibility.PUBLIC,
        description: null,
        systemType: null,
      });
      expect(result.id).toBe('pl-1');
    });

    it('honors explicit private visibility', async () => {
      await service.create(ownerId, 'Secret', PlaylistVisibility.PRIVATE);
      expect(playlistRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: PlaylistVisibility.PRIVATE }),
      );
    });

    it('honors unlisted visibility', async () => {
      await service.create(ownerId, 'Share link', PlaylistVisibility.UNLISTED);
      expect(playlistRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: PlaylistVisibility.UNLISTED }),
      );
    });
  });

  describe('findById', () => {
    it('throws when playlist missing', async () => {
      playlistRepository.findOne.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('blocks a private playlist from non-owner viewers', async () => {
      playlistRepository.findOne.mockResolvedValue({
        id: 'pl-1',
        userId: ownerId,
        visibility: PlaylistVisibility.PRIVATE,
      });
      await expect(service.findById('pl-1', otherId)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('allows the owner to view their private playlist', async () => {
      const playlist = {
        id: 'pl-1',
        userId: ownerId,
        visibility: PlaylistVisibility.PRIVATE,
      };
      playlistRepository.findOne.mockResolvedValue(playlist);
      await expect(service.findById('pl-1', ownerId)).resolves.toBe(playlist);
    });

    it('allows anyone to view a public playlist', async () => {
      const playlist = {
        id: 'pl-1',
        userId: ownerId,
        visibility: PlaylistVisibility.PUBLIC,
      };
      playlistRepository.findOne.mockResolvedValue(playlist);
      await expect(service.findById('pl-1', otherId)).resolves.toBe(playlist);
    });

    it('allows non-owners to view an unlisted playlist by id', async () => {
      const playlist = {
        id: 'pl-1',
        userId: ownerId,
        visibility: PlaylistVisibility.UNLISTED,
      };
      playlistRepository.findOne.mockResolvedValue(playlist);
      await expect(service.findById('pl-1', otherId)).resolves.toBe(playlist);
    });
  });

  describe('listByUser', () => {
    it('returns all playlists for the owner', async () => {
      qb.getMany.mockResolvedValue([{ id: 'pl-1' }]);
      await service.listByUser(ownerId, ownerId);
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('restricts to public playlists for other viewers', async () => {
      qb.getMany.mockResolvedValue([]);
      await service.listByUser(ownerId, otherId);
      expect(qb.andWhere).toHaveBeenCalledWith('p.visibility = :vis', {
        vis: PlaylistVisibility.PUBLIC,
      });
    });
  });

  describe('update', () => {
    it('updates title description and unlisted visibility for owner', async () => {
      const playlist = {
        id: 'pl-1',
        userId: ownerId,
        title: 'Old',
        description: null,
        visibility: PlaylistVisibility.PUBLIC,
        systemType: null,
      };
      playlistRepository.findOne.mockResolvedValue(playlist);
      playlistRepository.save.mockImplementation(async (p: Partial<Playlist>) => ({
        id: 'pl-1',
        ...p,
      }));
      const result = await service.update(ownerId, 'pl-1', {
        title: 'New',
        description: 'Desc',
        visibility: PlaylistVisibility.UNLISTED,
      });
      expect(result.title).toBe('New');
      expect(result.description).toBe('Desc');
      expect(result.visibility).toBe(PlaylistVisibility.UNLISTED);
    });

    it('forbids non-owner updates', async () => {
      playlistRepository.findOne.mockResolvedValue({
        id: 'pl-1',
        userId: ownerId,
        systemType: null,
      });
      await expect(
        service.update(otherId, 'pl-1', { title: 'Nope' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks title or visibility changes on system playlists', async () => {
      playlistRepository.findOne.mockResolvedValue({
        id: 'pl-1',
        userId: ownerId,
        systemType: PlaylistSystemType.WATCH_LATER,
        description: null,
      });
      await expect(
        service.update(ownerId, 'pl-1', { title: 'Nope' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('reorder', () => {
    it('reorders when every video id is included once', async () => {
      playlistRepository.findOne
        .mockResolvedValueOnce({
          id: 'pl-1',
          userId: ownerId,
          systemType: null,
        })
        .mockResolvedValueOnce({
          id: 'pl-1',
          userId: ownerId,
          visibility: PlaylistVisibility.PUBLIC,
          items: [],
        });
      const itemA = { videoId: 'v-a', position: 0 };
      const itemB = { videoId: 'v-b', position: 1 };
      playlistVideoRepository.find.mockResolvedValue([itemA, itemB]);
      await service.reorder(ownerId, 'pl-1', ['v-b', 'v-a']);
      expect(itemB.position).toBe(0);
      expect(itemA.position).toBe(1);
      expect(playlistVideoRepository.save).toHaveBeenCalledTimes(2);
    });

    it('rejects incomplete reorder payloads', async () => {
      playlistRepository.findOne.mockResolvedValue({
        id: 'pl-1',
        userId: ownerId,
        systemType: null,
      });
      playlistVideoRepository.find.mockResolvedValue([
        { videoId: 'v-a', position: 0 },
        { videoId: 'v-b', position: 1 },
      ]);
      await expect(service.reorder(ownerId, 'pl-1', ['v-a'])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('forbids non-owner reorder', async () => {
      playlistRepository.findOne.mockResolvedValue({
        id: 'pl-1',
        userId: ownerId,
        systemType: null,
      });
      await expect(service.reorder(otherId, 'pl-1', [])).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('addVideo', () => {
    it('throws when playlist missing', async () => {
      playlistRepository.findOne.mockResolvedValue(null);
      await expect(service.addVideo(ownerId, 'pl-1', 'v-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('forbids modifying another user playlist', async () => {
      playlistRepository.findOne.mockResolvedValue({ id: 'pl-1', userId: ownerId });
      await expect(service.addVideo(otherId, 'pl-1', 'v-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws when the video does not exist', async () => {
      playlistRepository.findOne.mockResolvedValue({ id: 'pl-1', userId: ownerId });
      videoRepository.findOne.mockResolvedValue(null);
      await expect(service.addVideo(ownerId, 'pl-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns existing row when video is already in the playlist', async () => {
      playlistRepository.findOne.mockResolvedValue({ id: 'pl-1', userId: ownerId });
      videoRepository.findOne.mockResolvedValue({ id: 'v-1' });
      playlistVideoRepository.findOne.mockResolvedValue({ id: 'pv-existing' });
      const result = await service.addVideo(ownerId, 'pl-1', 'v-1');
      expect(result).toEqual({ id: 'pv-existing' });
      expect(playlistVideoRepository.create).not.toHaveBeenCalled();
    });

    it('adds a new video to the playlist', async () => {
      playlistRepository.findOne.mockResolvedValue({ id: 'pl-1', userId: ownerId });
      videoRepository.findOne.mockResolvedValue({ id: 'v-1' });
      playlistVideoRepository.findOne.mockResolvedValue(null);
      const result = await service.addVideo(ownerId, 'pl-1', 'v-1');
      expect(playlistVideoRepository.create).toHaveBeenCalledWith({
        playlistId: 'pl-1',
        videoId: 'v-1',
        position: 0,
      });
      expect(result.id).toBe('pv-1');
    });
  });

  describe('removeVideo', () => {
    it('throws when playlist missing', async () => {
      playlistRepository.findOne.mockResolvedValue(null);
      await expect(service.removeVideo(ownerId, 'pl-1', 'v-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('forbids non-owner removal', async () => {
      playlistRepository.findOne.mockResolvedValue({ id: 'pl-1', userId: ownerId });
      await expect(service.removeVideo(otherId, 'pl-1', 'v-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('removes a video for the owner', async () => {
      playlistRepository.findOne.mockResolvedValue({ id: 'pl-1', userId: ownerId });
      playlistVideoRepository.delete.mockResolvedValue({ affected: 1 });
      const result = await service.removeVideo(ownerId, 'pl-1', 'v-1');
      expect(playlistVideoRepository.delete).toHaveBeenCalledWith({
        playlistId: 'pl-1',
        videoId: 'v-1',
      });
      expect(result).toEqual({ ok: true });
    });

    it('unlikes when removing from Liked system playlist', async () => {
      playlistRepository.findOne.mockResolvedValue({
        id: 'liked-1',
        userId: ownerId,
        systemType: PlaylistSystemType.LIKED,
      });
      likeRepository.findOne.mockResolvedValue({
        id: 'like-1',
        userId: ownerId,
        videoId: 'v-1',
        reaction: 'like',
      });
      const result = await service.removeVideo(ownerId, 'liked-1', 'v-1');
      expect(likeRepository.remove).toHaveBeenCalled();
      expect(videoRepository.decrement).toHaveBeenCalledWith({ id: 'v-1' }, 'likeCount', 1);
      expect(result).toEqual({ ok: true });
    });
  });

  describe('clearWatchLater / clearLikedVideos', () => {
    it('clears watch later items', async () => {
      playlistRepository.findOne.mockResolvedValue({
        id: 'wl-1',
        userId: ownerId,
        systemType: PlaylistSystemType.WATCH_LATER,
      });
      playlistVideoRepository.delete.mockResolvedValue({ affected: 3 });
      const result = await service.clearWatchLater(ownerId);
      expect(playlistVideoRepository.delete).toHaveBeenCalledWith({ playlistId: 'wl-1' });
      expect(result).toEqual({ ok: true });
    });

    it('clears liked videos and decrements counts', async () => {
      likeRepository.find.mockResolvedValue([
        { id: 'l1', userId: ownerId, videoId: 'v-1' },
        { id: 'l2', userId: ownerId, videoId: 'v-2' },
      ]);
      const result = await service.clearLikedVideos(ownerId);
      expect(likeRepository.remove).toHaveBeenCalledTimes(2);
      expect(videoRepository.decrement).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ ok: true, cleared: 2 });
    });
  });

  describe('listPlaylistIdsContainingVideo', () => {
    it('returns playlist ids that contain the video', async () => {
      playlistRepository.findOne.mockResolvedValue({ id: 'wl-1' });
      const result = await service.listPlaylistIdsContainingVideo(ownerId, 'v-1');
      expect(result.playlistIds).toEqual(['pl-1']);
    });
  });
});
