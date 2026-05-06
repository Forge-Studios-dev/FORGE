import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Playlist } from './entities/playlist.entity';
import { PlaylistVideo } from './entities/playlist-video.entity';
import { Video } from '../content/entities/video.entity';

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

  async create(userId: string, title: string): Promise<Playlist> {
    const playlist = this.playlistRepository.create({ userId, title });
    return this.playlistRepository.save(playlist);
  }

  async findById(id: string): Promise<Playlist> {
    const playlist = await this.playlistRepository.findOne({
      where: { id },
      relations: ['items', 'items.video', 'items.video.user', 'items.video.skillTags'],
      order: { items: { createdAt: 'DESC' } },
    });
    if (!playlist) throw new NotFoundException('Playlist not found');
    return playlist;
  }

  async listByUser(userId: string): Promise<Playlist[]> {
    return this.playlistRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
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

