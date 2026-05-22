import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Video } from '../content/entities/video.entity';
import { applyDiscoverableVideoFilters } from '../feed/feed-query.util';
import { VideosService } from '../content/videos.service';
import { User } from '../users/entities/user.entity';
import { toPublicUser } from '../users/user.mapper';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly videosService: VideosService,
  ) {}

  async search(q: string, limit = 20) {
    try {
      return await this.searchFts(q, limit);
    } catch (err) {
      this.logger.warn(
        `FTS search failed (${err instanceof Error ? err.message : String(err)}); falling back to ILIKE`,
      );
      return this.searchLegacy(q, limit);
    }
  }

  private async searchFts(q: string, limit = 20) {
    const take = Math.min(limit, 50);
    const term = q.trim();
    if (term.length < 2) {
      return { videos: [], users: [], meta: { q: term } };
    }

    const pattern = `%${term}%`;
    const videos = await applyDiscoverableVideoFilters(
      this.videoRepository
        .createQueryBuilder('v')
        .leftJoinAndSelect('v.user', 'user')
        .leftJoin('v.skillTags', 'st')
        .leftJoin('st.subcategory', 'sub')
        .leftJoin('sub.category', 'cat'),
    )
      .andWhere(
        `(v.searchVector @@ plainto_tsquery('english', :fts)
          OR v.title ILIKE :pattern
          OR v.description ILIKE :pattern
          OR st.name ILIKE :pattern
          OR cat.name ILIKE :pattern)`,
        { fts: term, pattern },
      )
      .orderBy(`ts_rank_cd(v.searchVector, plainto_tsquery('english', :fts))`, 'DESC')
      .addOrderBy('v.publishedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('v.createdAt', 'DESC')
      .take(take)
      .getMany();

    const users = await this.userRepository
      .createQueryBuilder('u')
      .where(`u.searchVector @@ plainto_tsquery('simple', :uq)`, { uq: term })
      .orderBy(`ts_rank_cd(u.searchVector, plainto_tsquery('simple', :uq))`, 'DESC')
      .addOrderBy('u.followerCount', 'DESC')
      .take(take)
      .getMany();

    return {
      videos: videos.map((v) => this.videosService.mapToPublicVideo(v)),
      users: users.map(toPublicUser),
      meta: { q: term, limit: take, mode: 'fts' as const },
    };
  }

  /** Prefix match on public ready video titles (cheap; complements FTS). */
  async suggestions(q: string, limit = 8) {
    const prefix = q.trim();
    if (prefix.length < 2) {
      return { titles: [] as string[] };
    }
    const take = Math.min(limit, 20);
    const rows = await applyDiscoverableVideoFilters(
      this.videoRepository.createQueryBuilder('v').select('v.title', 'title'),
    )
      .andWhere('v.title ILIKE :p', { p: `${prefix}%` })
      .orderBy('v.title', 'ASC')
      .distinct(true)
      .take(take)
      .getRawMany<{ title: string }>();
    return { titles: rows.map((r) => r.title) };
  }

  private async searchLegacy(q: string, limit = 20) {
    const take = Math.min(limit, 50);
    const term = q.trim();
    if (term.length < 2) {
      return { videos: [], users: [], meta: { q: term } };
    }
    const pattern = `%${term}%`;
    const videos = await applyDiscoverableVideoFilters(
      this.videoRepository.createQueryBuilder('v').leftJoinAndSelect('v.user', 'user'),
    )
      .leftJoin('v.skillTags', 'st')
      .leftJoin('st.subcategory', 'sub')
      .leftJoin('sub.category', 'cat')
      .andWhere(
        '(v.title ILIKE :q OR v.description ILIKE :q OR st.name ILIKE :q OR cat.name ILIKE :q)',
        { q: pattern },
      )
      .orderBy('v.createdAt', 'DESC')
      .take(take)
      .getMany();
    const users = await this.userRepository.find({
      where: [{ username: ILike(pattern) }, { displayName: ILike(pattern) }],
      order: { followerCount: 'DESC' },
      take,
    });
    return {
      videos: videos.map((v) => this.videosService.mapToPublicVideo(v)),
      users: users.map(toPublicUser),
      meta: { q: term, limit: take, mode: 'legacy_ilike' as const },
    };
  }
}
