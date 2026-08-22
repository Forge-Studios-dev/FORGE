import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In, IsNull, SelectQueryBuilder } from 'typeorm';
import { clampLimit } from '../../common/utils/pagination.util';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { createHash } from 'crypto';
import { Video, VideoType } from '../content/entities/video.entity';
import { applyDiscoverableVideoFilters } from '../feed/feed-query.util';
import { VideosService } from '../content/videos.service';
import { User } from '../users/entities/user.entity';
import { toPublicUser } from '../users/user.mapper';
import {
  Playlist,
  PlaylistVisibility,
} from '../playlists/entities/playlist.entity';
import { safeRedisGet, safeRedisSetex } from '../../common/redis/redis-safe.util';
import { jitterTtl, singleFlight } from '../../common/redis/cache-stampede.util';
import { getMutedChannelIds } from '../feed/not-interested.util';
import { mergeExcludedCreatorIds } from '../feed/viewer-exclusions.util';
import { EngagementService } from '../engagement/engagement.service';

const SEARCH_CACHE_TTL_SEC = 120;

export type SearchType = 'all' | 'video' | 'channel' | 'playlist';
/** YouTube-like duration buckets (seconds). */
export type SearchDuration = 'any' | 'short' | 'medium' | 'long';
/** Upload date window relative to now. */
export type SearchUploaded = 'any' | 'hour' | 'today' | 'week' | 'month' | 'year';
/** Video result ordering (YouTube Sort by). */
export type SearchSort = 'relevance' | 'date' | 'views';
/** Feature filters (YouTube Features). */
export type SearchCaptions = 'any' | 'yes';
/** Restrict to long-form videos or Shorts (`video_type`). */
export type SearchKind = 'any' | 'video' | 'short';
/** Filter by whether the signed-in viewer has watched the video. */
export type SearchWatched = 'any' | 'watched' | 'unwatched';

export type SearchFilters = {
  duration?: SearchDuration;
  uploaded?: SearchUploaded;
  sort?: SearchSort;
  captions?: SearchCaptions;
  kind?: SearchKind;
  watched?: SearchWatched;
};

export type PublicSearchPlaylist = {
  id: string;
  title: string;
  description: string | null;
  userId: string;
  visibility: PlaylistVisibility;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  } | null;
};

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Playlist)
    private readonly playlistRepository: Repository<Playlist>,
    private readonly videosService: VideosService,
    private readonly engagementService: EngagementService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private async excludedCreatorIds(viewerId?: string): Promise<string[]> {
    if (!viewerId) return [];
    const [muted, blocked] = await Promise.all([
      getMutedChannelIds(this.redis, viewerId, this.logger),
      this.engagementService.getBlockedPeerIds(viewerId),
    ]);
    return mergeExcludedCreatorIds(muted, blocked);
  }

  private normalizeFilters(filters?: SearchFilters): Required<SearchFilters> {
    const duration =
      filters?.duration === 'short' ||
      filters?.duration === 'medium' ||
      filters?.duration === 'long'
        ? filters.duration
        : 'any';
    const uploaded =
      filters?.uploaded === 'hour' ||
      filters?.uploaded === 'today' ||
      filters?.uploaded === 'week' ||
      filters?.uploaded === 'month' ||
      filters?.uploaded === 'year'
        ? filters.uploaded
        : 'any';
    const sort =
      filters?.sort === 'date' || filters?.sort === 'views' || filters?.sort === 'relevance'
        ? filters.sort
        : 'relevance';
    const captions = filters?.captions === 'yes' ? 'yes' : 'any';
    const kind =
      filters?.kind === 'video' || filters?.kind === 'short' ? filters.kind : 'any';
    const watched =
      filters?.watched === 'watched' || filters?.watched === 'unwatched'
        ? filters.watched
        : 'any';
    return { duration, uploaded, sort, captions, kind, watched };
  }

  private searchCacheKey(
    q: string,
    limit: number,
    type: SearchType,
    filters: Required<SearchFilters>,
  ): string {
    const hash = createHash('sha256')
      .update(
        `${q}:${limit}:${type}:${filters.duration}:${filters.uploaded}:${filters.sort}:${filters.captions}:${filters.kind}`,
      )
      .digest('hex')
      .slice(0, 16);
    return `search:v8:${hash}`;
  }

  private emptyResult(term: string, type: SearchType, filters: Required<SearchFilters>) {
    return {
      videos: [],
      users: [],
      playlists: [] as PublicSearchPlaylist[],
      meta: {
        q: term,
        type,
        duration: filters.duration,
        uploaded: filters.uploaded,
        sort: filters.sort,
        captions: filters.captions,
        kind: filters.kind,
        watched: filters.watched,
      },
    };
  }

  async search(
    q: string,
    limit = 20,
    type: SearchType = 'all',
    filters?: SearchFilters,
    viewerId?: string,
  ) {
    const term = q.trim();
    const searchType = this.normalizeType(type);
    const normalized = this.normalizeFilters(filters);
    // Results are personalized per viewer (block/mute exclusions, watched
    // filter) but the cache key isn't — never read or write the shared cache
    // for a signed-in viewer, matching feed.service.ts's pattern, or one
    // viewer's block/mute-filtered results leak into another viewer's results.
    const skipCache = normalized.watched !== 'any' || !!viewerId;
    if (term.length >= 2) {
      if (!skipCache) {
        const cacheKey = this.searchCacheKey(term, limit, searchType, normalized);
        const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch {
            /* corrupt */
          }
        }
        // singleFlight: a trending query's cache-miss burst shares one
        // DB round-trip per instance instead of N concurrent identical queries.
        return singleFlight(cacheKey, async () => {
          const result = await this.searchUncached(term, limit, searchType, normalized, viewerId);
          await safeRedisSetex(
            this.redis,
            cacheKey,
            jitterTtl(SEARCH_CACHE_TTL_SEC),
            JSON.stringify(result),
            this.logger,
          );
          return result;
        });
      }
      return this.searchUncached(term, limit, searchType, normalized, viewerId);
    }
    return this.emptyResult(term, searchType, normalized);
  }

  private normalizeType(type: string | undefined): SearchType {
    if (type === 'video' || type === 'channel' || type === 'playlist') return type;
    return 'all';
  }

  private applyVideoFilters(
    qb: SelectQueryBuilder<Video>,
    filters: Required<SearchFilters>,
    viewerId?: string,
    excludedCreators: string[] = [],
  ): SelectQueryBuilder<Video> {
    if (excludedCreators.length) {
      qb.andWhere('v.user_id NOT IN (:...searchExcludedCreators)', {
        searchExcludedCreators: excludedCreators,
      });
    }
    if (filters.duration === 'short') {
      qb.andWhere('v.duration_seconds IS NOT NULL AND v.duration_seconds < 240');
    } else if (filters.duration === 'medium') {
      qb.andWhere(
        'v.duration_seconds IS NOT NULL AND v.duration_seconds >= 240 AND v.duration_seconds <= 1200',
      );
    } else if (filters.duration === 'long') {
      qb.andWhere('v.duration_seconds IS NOT NULL AND v.duration_seconds > 1200');
    }

    if (filters.uploaded !== 'any') {
      const intervals: Record<Exclude<SearchUploaded, 'any'>, string> = {
        hour: '1 hour',
        today: '1 day',
        week: '7 days',
        month: '30 days',
        year: '365 days',
      };
      qb.andWhere(
        `COALESCE(v.published_at, v.created_at) >= NOW() - CAST(:uploadedInterval AS interval)`,
        { uploadedInterval: intervals[filters.uploaded] },
      );
    }
    if (filters.captions === 'yes') {
      qb.andWhere(
        `(v.caption_url IS NOT NULL OR (v.caption_tracks IS NOT NULL AND jsonb_array_length(v.caption_tracks) > 0))`,
      );
    }
    if (filters.kind === 'short') {
      qb.andWhere('v.video_type = :videoKind', { videoKind: VideoType.SHORT });
    } else if (filters.kind === 'video') {
      qb.andWhere('v.video_type = :videoKind', { videoKind: VideoType.VIDEO });
    }
    if (viewerId && filters.watched === 'watched') {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM watch_history wh WHERE wh.video_id = v.id AND wh.user_id = :watchViewerId)`,
        { watchViewerId: viewerId },
      );
    } else if (viewerId && filters.watched === 'unwatched') {
      qb.andWhere(
        `NOT EXISTS (SELECT 1 FROM watch_history wh WHERE wh.video_id = v.id AND wh.user_id = :watchViewerId)`,
        { watchViewerId: viewerId },
      );
    }
    return qb;
  }

  private applyVideoSort(
    qb: SelectQueryBuilder<Video>,
    sort: SearchSort,
    ftsTerm?: string,
  ): SelectQueryBuilder<Video> {
    if (sort === 'date') {
      return qb
        .orderBy('v.published_at', 'DESC', 'NULLS LAST')
        .addOrderBy('v.created_at', 'DESC');
    }
    if (sort === 'views') {
      return qb.orderBy('v.view_count', 'DESC').addOrderBy('v.created_at', 'DESC');
    }
    if (ftsTerm) {
      return qb
        .orderBy(`ts_rank_cd(v.searchVector, plainto_tsquery('english', :fts))`, 'DESC')
        .addOrderBy('v.published_at', 'DESC', 'NULLS LAST')
        .addOrderBy('v.created_at', 'DESC');
    }
    return qb.orderBy('v.createdAt', 'DESC');
  }

  private async searchUncached(
    q: string,
    limit: number,
    type: SearchType,
    filters: Required<SearchFilters>,
    viewerId?: string,
  ) {
    try {
      return await this.searchFts(q, limit, type, filters, viewerId);
    } catch (err) {
      this.logger.warn(
        `FTS search failed (${err instanceof Error ? err.message : String(err)}); falling back to ILIKE`,
      );
      return this.searchLegacy(q, limit, type, filters, viewerId);
    }
  }

  private async searchPlaylistsRanked(q: string, take: number): Promise<Playlist[]> {
    return this.playlistRepository
      .createQueryBuilder('p')
      .where('p.visibility = :visibility', { visibility: PlaylistVisibility.PUBLIC })
      .andWhere('p.systemType IS NULL')
      .andWhere(`p.searchVector @@ plainto_tsquery('english', :q)`, { q })
      .orderBy(`ts_rank_cd(p.searchVector, plainto_tsquery('english', :q))`, 'DESC')
      .addOrderBy('p.updatedAt', 'DESC')
      .take(take)
      .getMany();
  }

  private async searchPlaylistsLegacy(q: string, take: number): Promise<Playlist[]> {
    const pattern = `%${q}%`;
    return this.playlistRepository.find({
      where: [
        {
          visibility: PlaylistVisibility.PUBLIC,
          systemType: IsNull(),
          title: ILike(pattern),
        },
        {
          visibility: PlaylistVisibility.PUBLIC,
          systemType: IsNull(),
          description: ILike(pattern),
        },
      ],
      order: { updatedAt: 'DESC' },
      take,
    });
  }

  private async searchPlaylists(q: string, take: number): Promise<PublicSearchPlaylist[]> {
    const playlists = await this.searchPlaylistsRanked(q, take).catch((err) => {
      this.logger.warn(
        `Playlist FTS search failed (${err instanceof Error ? err.message : String(err)}); falling back to ILIKE`,
      );
      return this.searchPlaylistsLegacy(q, take);
    });

    const unique = [...new Map(playlists.map((p) => [p.id, p])).values()].slice(0, take);
    if (unique.length === 0) return [];

    const owners = await this.userRepository.find({
      where: { id: In([...new Set(unique.map((p) => p.userId))]) },
    });
    const byId = new Map(owners.map((u) => [u.id, u]));

    return unique.map((p) => {
      const owner = byId.get(p.userId);
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        userId: p.userId,
        visibility: p.visibility,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        owner: owner
          ? {
              id: owner.id,
              username: owner.username,
              displayName: owner.displayName,
              avatarUrl: owner.avatarUrl,
            }
          : null,
      };
    });
  }

  private async searchFts(
    q: string,
    limit = 20,
    type: SearchType = 'all',
    filters: Required<SearchFilters>,
    viewerId?: string,
  ) {
    const take = clampLimit(limit, 20, 50);
    const term = q.trim();
    if (term.length < 2) {
      return this.emptyResult(term, type, filters);
    }

    const pattern = `%${term}%`;
    const includeVideos = type === 'all' || type === 'video';
    const includeChannels = type === 'all' || type === 'channel';
    const includePlaylists = type === 'all' || type === 'playlist';
    const excludedCreators = await this.excludedCreatorIds(viewerId);

    const rankedVideos = includeVideos
      ? await this.applyVideoSort(
          this.applyVideoFilters(
            applyDiscoverableVideoFilters(
              this.videoRepository
                .createQueryBuilder('v')
                .leftJoinAndSelect('v.user', 'creator')
                .leftJoin('v.skillTags', 'st')
                .leftJoin('st.subcategory', 'sub')
                .leftJoin('sub.category', 'cat'),
            ).andWhere(
              `(v.searchVector @@ plainto_tsquery('english', :fts)
          OR v.title ILIKE :pattern
          OR v.description ILIKE :pattern
          OR st.name ILIKE :pattern
          OR cat.name ILIKE :pattern)`,
              { fts: term, pattern },
            ),
            filters,
            viewerId,
            excludedCreators,
          ),
          filters.sort,
          term,
        )
          .take(take)
          .getMany()
      : [];

    // When duration/upload filters are active on type=all, prefer videos only
    // (channels/playlists ignore those filters). Explicit type=channel|playlist still works.
    const videoFilterActive =
      filters.duration !== 'any' ||
      filters.uploaded !== 'any' ||
      filters.captions !== 'any' ||
      filters.kind !== 'any' ||
      filters.watched !== 'any';
    const loadChannels = includeChannels && !(videoFilterActive && type === 'all');
    const loadPlaylists = includePlaylists && !(videoFilterActive && type === 'all');

    let users = loadChannels
      ? await this.userRepository
          .createQueryBuilder('u')
          .where(`u.searchVector @@ plainto_tsquery('simple', :uq)`, { uq: term })
          .orderBy(`ts_rank_cd(u.searchVector, plainto_tsquery('simple', :uq))`, 'DESC')
          .addOrderBy('u.followerCount', 'DESC')
          .take(take)
          .getMany()
      : [];
    if (excludedCreators.length && users.length) {
      const blocked = new Set(excludedCreators);
      users = users.filter((u) => !blocked.has(u.id));
    }

    let playlists = loadPlaylists ? await this.searchPlaylists(term, take) : [];
    if (excludedCreators.length && playlists.length) {
      const blocked = new Set(excludedCreators);
      playlists = playlists.filter((p) => !blocked.has(p.userId));
    }

    return {
      videos: rankedVideos.map((v) => this.videosService.mapToPublicVideo(v)),
      users: users.map(toPublicUser),
      playlists,
      meta: {
        q: term,
        limit: take,
        mode: 'fts' as const,
        type,
        duration: filters.duration,
        uploaded: filters.uploaded,
        sort: filters.sort,
        captions: filters.captions,
        kind: filters.kind,
        watched: filters.watched,
      },
    };
  }

  async suggestions(q: string, limit = 8, viewerId?: string) {
    const prefix = q.trim();
    if (prefix.length < 2) {
      return { titles: [] as string[], channels: [] as { username: string; displayName: string }[] };
    }
    const take = clampLimit(limit, 8, 20);
    const channelTake = Math.min(5, take);
    const excluded = await this.excludedCreatorIds(viewerId);
    const titleQb = applyDiscoverableVideoFilters(
      this.videoRepository.createQueryBuilder('v').select('v.title', 'title'),
    ).andWhere('v.title ILIKE :p', { p: `${prefix}%` });
    if (excluded.length > 0) {
      titleQb.andWhere('v.user_id NOT IN (:...excluded)', { excluded });
    }
    const channelQb = this.userRepository
      .createQueryBuilder('u')
      .select(['u.id', 'u.username', 'u.displayName'])
      .where('(u.username ILIKE :p OR u.display_name ILIKE :p)', { p: `${prefix}%` })
      .orderBy('u.username', 'ASC')
      .take(channelTake);
    if (excluded.length > 0) {
      channelQb.andWhere('u.id NOT IN (:...excluded)', { excluded });
    }
    const [rows, channels] = await Promise.all([
      titleQb.orderBy('v.title', 'ASC').distinct(true).take(take).getRawMany<{ title: string }>(),
      channelQb.getMany(),
    ]);
    return {
      titles: rows.map((r) => r.title),
      channels: channels.map((u) => ({
        username: u.username,
        displayName: u.displayName,
      })),
    };
  }

  private async searchLegacy(
    q: string,
    limit = 20,
    type: SearchType = 'all',
    filters: Required<SearchFilters>,
    viewerId?: string,
  ) {
    const take = clampLimit(limit, 20, 50);
    const term = q.trim();
    if (term.length < 2) {
      return this.emptyResult(term, type, filters);
    }
    const pattern = `%${term}%`;
    const includeVideos = type === 'all' || type === 'video';
    const includeChannels = type === 'all' || type === 'channel';
    const includePlaylists = type === 'all' || type === 'playlist';
    const videoFilterActive =
      filters.duration !== 'any' ||
      filters.uploaded !== 'any' ||
      filters.captions !== 'any' ||
      filters.kind !== 'any' ||
      filters.watched !== 'any';
    const excludedCreators = await this.excludedCreatorIds(viewerId);

    const videos = includeVideos
      ? await this.applyVideoSort(
          this.applyVideoFilters(
            applyDiscoverableVideoFilters(
              this.videoRepository.createQueryBuilder('v').leftJoinAndSelect('v.user', 'creator'),
            )
              .leftJoin('v.skillTags', 'st')
              .leftJoin('st.subcategory', 'sub')
              .leftJoin('sub.category', 'cat')
              .andWhere(
                '(v.title ILIKE :q OR v.description ILIKE :q OR st.name ILIKE :q OR cat.name ILIKE :q)',
                { q: pattern },
              ),
            filters,
            viewerId,
            excludedCreators,
          ),
          filters.sort,
        )
          .take(take)
          .getMany()
      : [];

    let users =
      includeChannels && (!videoFilterActive || type === 'channel')
        ? await this.userRepository.find({
            where: [{ username: ILike(pattern) }, { displayName: ILike(pattern) }],
            order: { followerCount: 'DESC' },
            take,
          })
        : [];
    if (excludedCreators.length && users.length) {
      const blocked = new Set(excludedCreators);
      users = users.filter((u) => !blocked.has(u.id));
    }
    let playlists =
      includePlaylists && (!videoFilterActive || type === 'playlist')
        ? await this.searchPlaylists(term, take)
        : [];
    if (excludedCreators.length && playlists.length) {
      const blocked = new Set(excludedCreators);
      playlists = playlists.filter((p) => !blocked.has(p.userId));
    }

    return {
      videos: videos.map((v) => this.videosService.mapToPublicVideo(v)),
      users: users.map(toPublicUser),
      playlists,
      meta: {
        q: term,
        limit: take,
        mode: 'legacy_ilike' as const,
        type,
        duration: filters.duration,
        uploaded: filters.uploaded,
        sort: filters.sort,
        captions: filters.captions,
        kind: filters.kind,
        watched: filters.watched,
      },
    };
  }
}
