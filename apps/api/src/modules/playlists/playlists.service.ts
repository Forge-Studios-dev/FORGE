import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Playlist,
  PlaylistSystemType,
  PlaylistVisibility,
} from './entities/playlist.entity';
import { PlaylistVideo } from './entities/playlist-video.entity';
import { Video } from '../content/entities/video.entity';
import { Like, VideoReactionType } from '../engagement/entities/like.entity';

const LIKED_CLEAR_BATCH = 200;

@Injectable()
export class PlaylistsService {
  constructor(
    @InjectRepository(Playlist)
    private readonly playlistRepository: Repository<Playlist>,
    @InjectRepository(PlaylistVideo)
    private readonly playlistVideoRepository: Repository<PlaylistVideo>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(Like)
    private readonly likeRepository: Repository<Like>,
  ) {}

  async create(
    userId: string,
    title: string,
    visibility: PlaylistVisibility = PlaylistVisibility.PUBLIC,
    description?: string | null,
  ): Promise<Playlist> {
    const playlist = this.playlistRepository.create({
      userId,
      title,
      visibility,
      description: description ?? null,
      systemType: null,
    });
    return this.playlistRepository.save(playlist);
  }

  async findById(id: string, viewerId?: string | null): Promise<Playlist> {
    const playlist = await this.playlistRepository.findOne({
      where: { id },
      relations: ['items', 'items.video', 'items.video.user', 'items.video.skillTags'],
    });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (
      playlist.visibility === PlaylistVisibility.PRIVATE &&
      playlist.userId !== viewerId
    ) {
      throw new ForbiddenException('This playlist is private');
    }
    if (playlist.systemType === PlaylistSystemType.LIKED) {
      return this.buildLikedPlaylistView(playlist.userId, viewerId);
    }
    if (playlist.items?.length) {
      playlist.items.sort(
        (a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime(),
      );
    }
    return playlist;
  }

  async listByUser(userId: string, viewerId?: string | null): Promise<Playlist[]> {
    if (viewerId === userId) {
      await this.ensureSystemPlaylists(userId);
    }
    const qb = this.playlistRepository
      .createQueryBuilder('p')
      .loadRelationCountAndMap('p.videoCount', 'p.items')
      .where('p.userId = :userId', { userId })
      .orderBy('p.systemType', 'ASC', 'NULLS LAST')
      .addOrderBy('p.createdAt', 'DESC');
    if (viewerId !== userId) {
      qb.andWhere('p.visibility = :vis', { vis: PlaylistVisibility.PUBLIC });
      qb.andWhere('p.systemType IS NULL');
    }
    const playlists = await qb.getMany();
    if (viewerId === userId) {
      const liked = playlists.find((p) => p.systemType === PlaylistSystemType.LIKED);
      if (liked) {
        liked.videoCount = await this.likeRepository.count({
          where: { userId, reaction: VideoReactionType.LIKE },
        });
      }
    }
    return playlists;
  }

  async ensureSystemPlaylists(userId: string): Promise<void> {
    await this.getOrCreateSystemPlaylist(userId, PlaylistSystemType.WATCH_LATER);
    await this.getOrCreateSystemPlaylist(userId, PlaylistSystemType.LIKED);
  }

  async getOrCreateSystemPlaylist(
    userId: string,
    systemType: PlaylistSystemType,
  ): Promise<Playlist> {
    const existing = await this.playlistRepository.findOne({
      where: { userId, systemType },
    });
    if (existing) return existing;

    const titles: Record<PlaylistSystemType, string> = {
      [PlaylistSystemType.WATCH_LATER]: 'Watch later',
      [PlaylistSystemType.LIKED]: 'Liked videos',
    };
    const playlist = this.playlistRepository.create({
      userId,
      title: titles[systemType],
      visibility: PlaylistVisibility.PRIVATE,
      systemType,
      description: null,
    });
    return this.playlistRepository.save(playlist);
  }

  async getSystemPlaylist(
    userId: string,
    systemType: PlaylistSystemType,
    viewerId?: string | null,
  ): Promise<Playlist> {
    if (systemType === PlaylistSystemType.LIKED) {
      return this.buildLikedPlaylistView(userId, viewerId);
    }
    const playlist = await this.getOrCreateSystemPlaylist(userId, systemType);
    return this.findById(playlist.id, viewerId ?? userId);
  }

  /** Liked videos as a playlist-shaped view (synced from reactions). */
  private async buildLikedPlaylistView(
    userId: string,
    viewerId?: string | null,
  ): Promise<Playlist> {
    if (viewerId !== userId) {
      throw new ForbiddenException('Liked videos playlist is private');
    }
    const shell = await this.getOrCreateSystemPlaylist(userId, PlaylistSystemType.LIKED);
    const likes = await this.likeRepository.find({
      where: { userId, reaction: VideoReactionType.LIKE },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    const videoIds = likes.map((l) => l.videoId);
    const videos =
      videoIds.length === 0
        ? []
        : await this.videoRepository.find({
            where: { id: In(videoIds) },
            relations: ['user', 'skillTags'],
          });
    const byId = new Map(videos.map((v) => [v.id, v]));
    const items = likes
      .map((like, index) => {
        const video = byId.get(like.videoId);
        if (!video) return null;
        return {
          id: like.id,
          playlistId: shell.id,
          videoId: like.videoId,
          position: index,
          createdAt: like.createdAt,
          video,
        } as PlaylistVideo;
      })
      .filter(Boolean) as PlaylistVideo[];

    return { ...shell, items };
  }

  async update(
    requesterId: string,
    playlistId: string,
    patch: {
      title?: string;
      description?: string | null;
      visibility?: PlaylistVisibility;
    },
  ): Promise<Playlist> {
    const playlist = await this.playlistRepository.findOne({ where: { id: playlistId } });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== requesterId) {
      throw new ForbiddenException('Cannot modify another user’s playlist');
    }
    if (playlist.systemType) {
      if (patch.title !== undefined || patch.visibility !== undefined) {
        throw new BadRequestException('System playlists cannot change title or visibility');
      }
    }
    if (patch.title !== undefined) playlist.title = patch.title;
    if (patch.description !== undefined) playlist.description = patch.description;
    if (patch.visibility !== undefined) playlist.visibility = patch.visibility;
    return this.playlistRepository.save(playlist);
  }

  async delete(requesterId: string, playlistId: string) {
    const playlist = await this.playlistRepository.findOne({ where: { id: playlistId } });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== requesterId) {
      throw new ForbiddenException('Cannot delete another user’s playlist');
    }
    if (playlist.systemType) {
      throw new BadRequestException('System playlists cannot be deleted');
    }
    await this.playlistRepository.remove(playlist);
    return { ok: true };
  }

  async addVideo(requesterId: string, playlistId: string, videoId: string) {
    const playlist = await this.playlistRepository.findOne({ where: { id: playlistId } });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== requesterId) {
      throw new ForbiddenException('Cannot modify another user’s playlist');
    }
    if (playlist.systemType === PlaylistSystemType.LIKED) {
      throw new BadRequestException('Liked videos are managed by liking a video');
    }

    const video = await this.videoRepository.findOne({ where: { id: videoId } });
    if (!video) throw new NotFoundException('Video not found');

    const existing = await this.playlistVideoRepository.findOne({
      where: { playlistId, videoId },
    });
    if (existing) return existing;

    const maxPos = await this.playlistVideoRepository
      .createQueryBuilder('pv')
      .select('COALESCE(MAX(pv.position), -1)', 'max')
      .where('pv.playlist_id = :playlistId', { playlistId })
      .getRawOne<{ max: string }>();
    const position = (parseInt(maxPos?.max ?? '-1', 10) || -1) + 1;

    const item = this.playlistVideoRepository.create({ playlistId, videoId, position });
    return this.playlistVideoRepository.save(item);
  }

  async removeVideo(requesterId: string, playlistId: string, videoId: string) {
    const playlist = await this.playlistRepository.findOne({ where: { id: playlistId } });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== requesterId) {
      throw new ForbiddenException('Cannot modify another user’s playlist');
    }
    if (playlist.systemType === PlaylistSystemType.LIKED) {
      return this.removeLikedVideo(requesterId, videoId);
    }

    await this.playlistVideoRepository.delete({ playlistId, videoId });
    return { ok: true };
  }

  /** Unlike a video (Liked playlist remove). Keeps likeCount in sync. */
  async removeLikedVideo(userId: string, videoId: string) {
    const like = await this.likeRepository.findOne({
      where: { userId, videoId, reaction: VideoReactionType.LIKE },
    });
    if (like) {
      await this.likeRepository.remove(like);
      await this.videoRepository.decrement({ id: videoId }, 'likeCount', 1);
    }
    return { ok: true };
  }

  async clearWatchLater(userId: string) {
    const playlist = await this.getOrCreateSystemPlaylist(
      userId,
      PlaylistSystemType.WATCH_LATER,
    );
    await this.playlistVideoRepository.delete({ playlistId: playlist.id });
    return { ok: true };
  }

  /** Remove all likes (Liked videos clear). Caps at recent Liked shelf size. */
  async clearLikedVideos(userId: string) {
    const likes = await this.likeRepository.find({
      where: { userId, reaction: VideoReactionType.LIKE },
      order: { createdAt: 'DESC' },
      take: LIKED_CLEAR_BATCH,
    });
    for (const like of likes) {
      await this.likeRepository.remove(like);
      await this.videoRepository.decrement({ id: like.videoId }, 'likeCount', 1);
    }
    return { ok: true, cleared: likes.length };
  }

  async reorder(
    requesterId: string,
    playlistId: string,
    videoIds: string[],
  ): Promise<Playlist> {
    const playlist = await this.playlistRepository.findOne({ where: { id: playlistId } });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== requesterId) {
      throw new ForbiddenException('Cannot modify another user’s playlist');
    }
    if (playlist.systemType === PlaylistSystemType.LIKED) {
      throw new BadRequestException('Liked videos order follows like time');
    }

    const normalizedVideoIds = Array.isArray(videoIds) ? videoIds.slice(0, 500) : [];
    const items = await this.playlistVideoRepository.find({ where: { playlistId } });
    const byVideo = new Map(items.map((i) => [i.videoId, i]));
    if (
      normalizedVideoIds.length !== items.length ||
      normalizedVideoIds.some((id) => !byVideo.has(id))
    ) {
      throw new BadRequestException('Reorder must include every video in the playlist exactly once');
    }

    for (let i = 0; i < normalizedVideoIds.length; i++) {
      const item = byVideo.get(normalizedVideoIds[i])!;
      item.position = i;
      await this.playlistVideoRepository.save(item);
    }

    return this.findById(playlistId, requesterId);
  }

  async addToWatchLater(userId: string, videoId: string) {
    const playlist = await this.getOrCreateSystemPlaylist(
      userId,
      PlaylistSystemType.WATCH_LATER,
    );
    return this.addVideo(userId, playlist.id, videoId);
  }

  async removeFromWatchLater(userId: string, videoId: string) {
    const playlist = await this.getOrCreateSystemPlaylist(
      userId,
      PlaylistSystemType.WATCH_LATER,
    );
    return this.removeVideo(userId, playlist.id, videoId);
  }

  async isInWatchLater(userId: string, videoId: string): Promise<boolean> {
    const playlist = await this.playlistRepository.findOne({
      where: { userId, systemType: PlaylistSystemType.WATCH_LATER },
    });
    if (!playlist) return false;
    const existing = await this.playlistVideoRepository.findOne({
      where: { playlistId: playlist.id, videoId },
    });
    return !!existing;
  }

  /** Playlist IDs (excluding Liked) that already contain this video. */
  async listPlaylistIdsContainingVideo(
    userId: string,
    videoId: string,
  ): Promise<{ playlistIds: string[] }> {
    await this.ensureSystemPlaylists(userId);
    const rows = await this.playlistVideoRepository
      .createQueryBuilder('pv')
      .innerJoin('pv.playlist', 'p')
      .select('pv.playlist_id', 'playlistId')
      .where('p.user_id = :userId', { userId })
      .andWhere('pv.video_id = :videoId', { videoId })
      .andWhere('(p.system_type IS NULL OR p.system_type = :watchLater)', {
        watchLater: PlaylistSystemType.WATCH_LATER,
      })
      .getRawMany<{ playlistId: string }>();
    return { playlistIds: rows.map((r) => r.playlistId) };
  }
}
