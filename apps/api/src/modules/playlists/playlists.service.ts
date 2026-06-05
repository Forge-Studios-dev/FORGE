import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Playlist, PlaylistVisibility } from './entities/playlist.entity';
import { PlaylistVideo } from './entities/playlist-video.entity';
import { Video } from '../content/entities/video.entity';
import { MAX_LIST_LIMIT } from '../../common/utils/pagination.util';

@Injectable()
export class PlaylistsService {
  constructor(
    @InjectRepository(Playlist)
    private readonly playlistRepository: Repository<Playlist>,
    @InjectRepository(PlaylistVideo)
    private readonly playlistVideoRepository: Repository<PlaylistVideo>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
  ) {}

  async create(
    userId: string,
    title: string,
    visibility: PlaylistVisibility = PlaylistVisibility.PUBLIC,
  ): Promise<Playlist> {
    const playlist = this.playlistRepository.create({ userId, title, visibility });
    return this.playlistRepository.save(playlist);
  }

  async findById(id: string, viewerId?: string | null): Promise<Playlist> {
    const playlist = await this.playlistRepository.findOne({
      where: { id },
      relations: ['items', 'items.video', 'items.video.user', 'items.video.skillTags'],
      order: { items: { createdAt: 'DESC' } },
    });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (
      playlist.visibility === PlaylistVisibility.PRIVATE &&
      playlist.userId !== viewerId
    ) {
      throw new ForbiddenException('This playlist is private');
    }
    return playlist;
  }

  async listByUser(userId: string, viewerId?: string | null): Promise<Playlist[]> {
    const qb = this.playlistRepository
      .createQueryBuilder('p')
      .where('p.userId = :userId', { userId })
      .orderBy('p.createdAt', 'DESC');
    if (viewerId !== userId) {
      qb.andWhere('p.visibility = :vis', { vis: PlaylistVisibility.PUBLIC });
    }
    return qb.take(MAX_LIST_LIMIT).getMany();
  }

  async addVideo(requesterId: string, playlistId: string, videoId: string) {
    const playlist = await this.playlistRepository.findOne({ where: { id: playlistId } });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== requesterId) throw new ForbiddenException('Cannot modify another user’s playlist');

    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');

    const existing = await this.playlistVideoRepository.findOne({ where: { playlistId, videoId } });
    if (existing) throw new BadRequestException('Video already in playlist');

    const item = this.playlistVideoRepository.create({ playlistId, videoId });
    return this.playlistVideoRepository.save(item);
  }

  async removeVideo(requesterId: string, playlistId: string, videoId: string) {
    const playlist = await this.playlistRepository.findOne({ where: { id: playlistId } });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== requesterId) throw new ForbiddenException('Cannot modify another user’s playlist');

    await this.playlistVideoRepository.delete({ playlistId, videoId });
    return { ok: true };
  }
}

