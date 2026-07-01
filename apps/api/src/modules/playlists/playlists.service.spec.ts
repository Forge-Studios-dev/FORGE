import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlaylistsService } from './playlists.service';
import { Playlist, PlaylistVisibility } from './entities/playlist.entity';
import { PlaylistVideo } from './entities/playlist-video.entity';
import { Video } from '../content/entities/video.entity';

describe('PlaylistsService', () => {
  let service: PlaylistsService;

  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const playlistRepository = {
    create: jest.fn((dto: Partial<Playlist>) => dto),
    save: jest.fn(async (dto: Partial<Playlist>) => ({ id: 'pl-1', ...dto })),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  };
  const playlistVideoRepository = {
    create: jest.fn((dto: Partial<PlaylistVideo>) => dto),
    save: jest.fn(async (dto: Partial<PlaylistVideo>) => ({ id: 'pv-1', ...dto })),
    findOne: jest.fn(),
    delete: jest.fn(),
  };
  const videoRepository = { findOne: jest.fn() };

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
      });
      expect(result.id).toBe('pl-1');
    });

    it('honors explicit private visibility', async () => {
      await service.create(ownerId, 'Secret', PlaylistVisibility.PRIVATE);
      expect(playlistRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: PlaylistVisibility.PRIVATE }),
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

    it('rejects duplicate videos in a playlist', async () => {
      playlistRepository.findOne.mockResolvedValue({ id: 'pl-1', userId: ownerId });
      videoRepository.findOne.mockResolvedValue({ id: 'v-1' });
      playlistVideoRepository.findOne.mockResolvedValue({ id: 'pv-existing' });
      await expect(service.addVideo(ownerId, 'pl-1', 'v-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('adds a new video to the playlist', async () => {
      playlistRepository.findOne.mockResolvedValue({ id: 'pl-1', userId: ownerId });
      videoRepository.findOne.mockResolvedValue({ id: 'v-1' });
      playlistVideoRepository.findOne.mockResolvedValue(null);
      const result = await service.addVideo(ownerId, 'pl-1', 'v-1');
      expect(playlistVideoRepository.create).toHaveBeenCalledWith({
        playlistId: 'pl-1',
        videoId: 'v-1',
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
  });
});
