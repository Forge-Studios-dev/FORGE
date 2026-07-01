import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import type { FeedSort } from '@forge/shared-types';

export type { FeedSort };
import { Video } from '../content/entities/video.entity';
import { applyDiscoverableVideoFilters } from './feed-query.util';
import { VideosService } from '../content/videos.service';
import { Follow } from '../engagement/entities/follow.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { Category } from '../categories/entities/category.entity';
import { EngagementService } from '../engagement/engagement.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import {
  safeRedisDel,
  safeRedisGet,
  safeRedisIncr,
  safeRedisSetex,
} from '../../common/redis/redis-safe.util';

const FEED_CACHE_TTL_BASE = 300;
const FEED_CACHE_JITTER_SEC = 60;
const FEED_CACHE_GEN_KEY = 'feed:cache:generation';

/** SQL expression — must match ordering for popular / forYou base component. */
export const POPULAR_SCORE_SQL = `(v.view_count * 0.6 + v.like_count * 0.3 + (EXTRACT(EPOCH FROM v.created_at) / 86400) * 0.1)`;

/** Sort key for latest/popular/forYou tie-break (use addSelect alias — not raw orderBy). */
export const SORT_TIME_SQL = 'COALESCE(v.published_at, v.created_at)';

type PopularCursor = { sort: 'popular'; s: number; ca: string; id: string };
type LatestCursor = { sort: 'latest'; ca: string; id: string };
type ForYouCursor = { sort: 'forYou'; s: number; ca: string; id: string };
type LegacyLatestCursor = { sort: 'legacy'; iso: string };

type FeedCursor = PopularCursor | LatestCursor | ForYouCursor | LegacyLatestCursor;

function popularScore(v: Pick<Video, 'viewCount' | 'likeCount' | 'createdAt'>): number {
  return (
    v.viewCount * 0.6 +
    v.likeCount * 0.3 +
    (v.createdAt.getTime() / 1000 / 86400) * 0.1
  );
}

function forYouScore(
  v: Pick<Video, 'userId' | 'viewCount' | 'likeCount' | 'createdAt'>,
  following: Set<string>,
  affinity: Set<string>,
): number {
  let boost = 0;
  if (following.has(v.userId)) boost += 2;
  if (affinity.has(v.userId)) boost += 1;
  return boost + popularScore(v);
}

function encodeCursor(c: FeedCursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

function parseCursor(raw: string | undefined, sort: FeedSort): FeedCursor | null {
  if (!raw) return null;
  try {
    const json = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as FeedCursor;
    if (json && json.sort === sort) return json;
  } catch {
    try {
      const json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as FeedCursor;
      if (json && json.sort === sort) return json;
    } catch {
      /* legacy */
    }
  }
  if (sort === 'latest') {
    try {
      const iso = Buffer.from(raw, 'base64').toString('utf8');
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) return { sort: 'legacy', iso };
    } catch {
      return null;
    }
  }
  return null;
}

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(WatchHistory)
    private readonly watchHistoryRepository: Repository<WatchHistory>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly videosService: VideosService,
    private readonly engagementService: EngagementService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  private feedCacheTtl(): number {
    return FEED_CACHE_TTL_BASE + Math.floor(Math.random() * FEED_CACHE_JITTER_SEC);
  }

  private async feedCacheGeneration(): Promise<number> {
    const raw = await safeRedisGet(this.redis, FEED_CACHE_GEN_KEY, this.logger);
    if (raw) return parseInt(raw, 10) || 1;
    await safeRedisSetex(this.redis, FEED_CACHE_GEN_KEY, 86400 * 30, '1', this.logger);
    return 1;
  }

  async getFeed(options: {
    categoryId?: string;
    categorySlug?: string;
    skillTagIds?: string[];
    skillTagSlugs?: string[];
    cursor?: string;
    limit?: number;
    sort?: FeedSort;
    userId?: string;
  }) {
    const limit = Math.min(options.limit || 20, 50);
    let sort: FeedSort = options.sort || 'latest';
    if (sort === 'forYou' && !options.userId) {
      sort = 'latest';
    }

    let categoryId = options.categoryId;
    if (!categoryId && options.categorySlug) {
      const cat = await this.categoryRepository.findOne({
        where: { slug: options.categorySlug },
      });
      categoryId = cat?.id;
    }

    const skillKey =
      options.skillTagIds?.length
        ? options.skillTagIds.sort().join(',')
        : options.skillTagSlugs?.length
          ? options.skillTagSlugs.sort().join(',')
          : 'all';
    const gen = await this.feedCacheGeneration();
    const cacheKey = `feed:v4:g${gen}:${sort}:${categoryId || options.categorySlug || 'all'}:${skillKey}:${options.cursor || 'start'}:${limit}`;

    const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
    if (cached && !options.userId && sort !== 'forYou') {
      try {
        return JSON.parse(cached);
      } catch {
        /* corrupt cache — fall through to DB */
      }
    }

    let followingIds: string[] = [];
    let affinityIds: string[] = [];
    if (sort === 'forYou' && options.userId) {
      const followingRows = await this.followRepository.find({
        where: { followerId: options.userId },
        select: ['followingId'],
        take: 500,
      });
      followingIds = followingRows.map((r) => r.followingId);
      const watched = await this.watchHistoryRepository.find({
        where: { userId: options.userId },
        relations: ['video'],
        order: { watchedAt: 'DESC' },
        take: 100,
      });
      const aff = new Set(
        watched.map((w) => w.video?.userId).filter((id): id is string => !!id),
      );
      affinityIds = [...aff];
    }

    const query = applyDiscoverableVideoFilters(
      this.videoRepository.createQueryBuilder('v'),
    )
      .select('v.id', 'id')
      .addSelect(SORT_TIME_SQL, 'sort_time');

    if (categoryId) {
      query.andWhere(
        `(v.category_id = :categoryId OR EXISTS (
          SELECT 1 FROM video_skill_tags vst
          INNER JOIN skill_tags st ON st.id = vst.skill_tag_id
          INNER JOIN subcategories sub ON sub.id = st.subcategory_id
          WHERE vst.video_id = v.id AND sub.category_id = :categoryId
        ))`,
        { categoryId },
      );
    }

    if (options.skillTagIds?.length) {
      query
        .innerJoin('v.skillTags', 'filterTag')
        .andWhere('filterTag.id IN (:...skillTagIds)', { skillTagIds: options.skillTagIds });
    } else if (options.skillTagSlugs?.length) {
      query
        .innerJoin('v.skillTags', 'filterTag')
        .andWhere('filterTag.slug IN (:...skillTagSlugs)', { skillTagSlugs: options.skillTagSlugs });
    }

    const cursor = parseCursor(options.cursor, sort);

    if (sort === 'popular') {
      query.addSelect(POPULAR_SCORE_SQL, 'score');
      query
        .orderBy('score', 'DESC')
        .addOrderBy('sort_time', 'DESC')
        .addOrderBy('v.id', 'DESC');
      if (cursor && cursor.sort === 'popular') {
        query.andWhere(`(${POPULAR_SCORE_SQL}, ${SORT_TIME_SQL}, v.id) < (:cs, :ca, :cid)`, {
          cs: cursor.s,
          ca: new Date(cursor.ca),
          cid: cursor.id,
        });
      }
    } else if (sort === 'forYou' && options.userId) {
      const followCase =
        followingIds.length > 0
          ? `(CASE WHEN v.user_id IN (:...followingIds) THEN 2.0 ELSE 0.0 END)`
          : `0.0`;
      const affCase =
        affinityIds.length > 0
          ? `(CASE WHEN v.user_id IN (:...affinityIds) THEN 1.0 ELSE 0.0 END)`
          : `0.0`;
      const personSql = `(${followCase} + ${affCase} + ${POPULAR_SCORE_SQL})`;
      query.addSelect(personSql, 'person_score');
      query
        .orderBy('person_score', 'DESC')
        .addOrderBy('sort_time', 'DESC')
        .addOrderBy('v.id', 'DESC');
      if (followingIds.length) query.setParameter('followingIds', followingIds);
      if (affinityIds.length) query.setParameter('affinityIds', affinityIds);

      if (cursor && cursor.sort === 'forYou') {
        query.andWhere(`(${personSql}, ${SORT_TIME_SQL}, v.id) < (:cs, :ca, :cid)`, {
          cs: cursor.s,
          ca: new Date(cursor.ca),
          cid: cursor.id,
        });
      }
    } else {
      query.orderBy('sort_time', 'DESC').addOrderBy('v.id', 'DESC');
      if (cursor) {
        if (cursor.sort === 'latest') {
          query.andWhere(`(${SORT_TIME_SQL}, v.id) < (:ca, :cid)`, {
            ca: new Date(cursor.ca),
            cid: cursor.id,
          });
        } else if (cursor.sort === 'legacy') {
          const d = new Date(cursor.iso);
          if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid cursor');
          query.andWhere(`${SORT_TIME_SQL} < :legacyCursor`, { legacyCursor: d });
        }
      }
    }

    query.limit(limit + 1);

    type IdRow = { id: string; sort_time?: string | Date; score?: string; person_score?: string };
    const idRows = (await query.getRawMany()) as IdRow[];
    const hasMore = idRows.length > limit;
    const pageRows = hasMore ? idRows.slice(0, limit) : idRows;
    const ids = pageRows.map((row) => row.id);

    if (!ids.length) {
      return { data: [], meta: { cursor: null, hasMore: false } };
    }

    const hydrated = await this.videoRepository.find({
      where: { id: In(ids) },
      relations: ['user', 'skillTags', 'skillTags.subcategory', 'skillTags.subcategory.category'],
    });
    const byId = new Map(hydrated.map((v) => [v.id, v]));
    const data = ids.map((id) => byId.get(id)).filter((v): v is Video => !!v);

    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const last = data[data.length - 1];
      if (sort === 'popular') {
        nextCursor = encodeCursor({
          sort: 'popular',
          s: popularScore(last),
          ca: (last.publishedAt ?? last.createdAt).toISOString(),
          id: last.id,
        });
      } else if (sort === 'latest') {
        const sortTime = last.publishedAt ?? last.createdAt;
        nextCursor = encodeCursor({
          sort: 'latest',
          ca: sortTime.toISOString(),
          id: last.id,
        });
      } else if (sort === 'forYou' && options.userId) {
        const following = new Set(followingIds);
        const affinity = new Set(affinityIds);
        nextCursor = encodeCursor({
          sort: 'forYou',
          s: forYouScore(last, following, affinity),
          ca: (last.publishedAt ?? last.createdAt).toISOString(),
          id: last.id,
        });
      }
    }

    const result = {
      data: data.map((v) => this.videosService.mapToPublicVideo(v)),
      meta: { cursor: nextCursor, hasMore },
    };

    if (!options.userId && sort !== 'forYou') {
      await safeRedisSetex(
        this.redis,
        cacheKey,
        this.feedCacheTtl(),
        JSON.stringify(result),
        this.logger,
      );
    }

    return result;
  }

  /** Videos from followed + subscribed creators only. */
  async getFollowingFeed(options: {
    userId: string;
    cursor?: string;
    limit?: number;
  }) {
    if (!options.userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const limit = Math.min(options.limit || 20, 50);
    const followingIds = await this.engagementService.getFollowingCreatorIds(options.userId);
    const subs = await this.entitlementsService.listMySubscriptions(options.userId);
    const subscribedCreatorIds = subs.map((s) => s.creatorId).filter(Boolean);
    const creatorIds = [...new Set([...followingIds, ...subscribedCreatorIds])];

    if (!creatorIds.length) {
      return { data: [], meta: { cursor: null, hasMore: false } };
    }

    const gen = await this.feedCacheGeneration();
    const cacheKey = `feed:following:g${gen}:${options.userId}:${options.cursor || 'start'}:${limit}`;
    const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        /* fall through */
      }
    }

    type LatestCursor = { sort: 'following'; ca: string; id: string };
    let cursor: LatestCursor | null = null;
    if (options.cursor) {
      try {
        const parsed = JSON.parse(
          Buffer.from(options.cursor, 'base64url').toString('utf-8'),
        ) as LatestCursor;
        if (parsed?.sort === 'following') cursor = parsed;
      } catch {
        /* invalid cursor */
      }
    }

    const query = applyDiscoverableVideoFilters(
      this.videoRepository.createQueryBuilder('v'),
    )
      .andWhere('v.user_id IN (:...creatorIds)', { creatorIds })
      .orderBy(SORT_TIME_SQL, 'DESC')
      .addOrderBy('v.id', 'DESC')
      .take(limit + 1);

    if (cursor) {
      query.andWhere(`(${SORT_TIME_SQL}, v.id) < (:ca, :cid)`, {
        ca: new Date(cursor.ca),
        cid: cursor.id,
      });
    }

    const videos = await query.getMany();
    const hasMore = videos.length > limit;
    const page = hasMore ? videos.slice(0, limit) : videos;

    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({
          sort: 'following',
          ca: (last.publishedAt ?? last.createdAt).toISOString(),
          id: last.id,
        }),
        'utf-8',
      ).toString('base64url');
    }

    const hydrated = page.length
      ? await this.videoRepository.find({
          where: { id: In(page.map((v) => v.id)) },
          relations: ['user', 'skillTags', 'skillTags.subcategory', 'skillTags.subcategory.category'],
        })
      : [];
    const byId = new Map(hydrated.map((v) => [v.id, v]));
    const data = page.map((v) => byId.get(v.id)).filter((v): v is Video => !!v);

    const result = {
      data: data.map((v) => this.videosService.mapToPublicVideo(v)),
      meta: { cursor: nextCursor, hasMore },
    };

    await safeRedisSetex(
      this.redis,
      cacheKey,
      this.feedCacheTtl(),
      JSON.stringify(result),
      this.logger,
    );

    return result;
  }

  /**
   * Content-based "related / watch-next" recommendations for a video.
   *
   * Reuses the discoverable-video filters and popularity score. Relevance is a
   * cheap, deterministic, index-friendly content signal (no ML infra):
   *   shared skill tags ×3  +  same category ×2  +  same creator ×1
   * ordered by relevance then popularity. Already-watched videos are excluded
   * for signed-in viewers, and the rail is topped up with popular discoverable
   * videos so it is never empty. Anonymous results are cached.
   */
  async getRelatedVideos(opts: { videoId: string; userId?: string; limit?: number }) {
    const limit = Math.min(opts.limit || 12, 24);
    const source = await this.videoRepository.findOne({
      where: { id: opts.videoId },
      relations: ['skillTags'],
    });
    if (!source) throw new NotFoundException('Video not found');

    const tagIds = (source.skillTags ?? []).map((t) => t.id);
    const categoryId = source.categoryId ?? null;
    const creatorId = source.userId;

    const cacheKey = `related:v1:${opts.videoId}:${limit}`;
    if (!opts.userId) {
      const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          /* corrupt cache — fall through to DB */
        }
      }
    }

    const sharedTagsSql = tagIds.length
      ? `(SELECT COUNT(*) FROM video_skill_tags vst WHERE vst.video_id = v.id AND vst.skill_tag_id IN (:...relTagIds))`
      : `0`;
    const categorySql = categoryId
      ? `(CASE WHEN v.category_id = :relCategoryId THEN 1 ELSE 0 END)`
      : `0`;
    const creatorSql = `(CASE WHEN v.user_id = :relCreatorId THEN 1 ELSE 0 END)`;
    const relevanceSql = `(${sharedTagsSql} * 3 + ${categorySql} * 2 + ${creatorSql})`;

    const buildBase = () => {
      const q = applyDiscoverableVideoFilters(this.videoRepository.createQueryBuilder('v'))
        .select('v.id', 'id')
        .andWhere('v.id != :relSourceId', { relSourceId: opts.videoId })
        .setParameter('relCreatorId', creatorId);
      if (tagIds.length) q.setParameter('relTagIds', tagIds);
      if (categoryId) q.setParameter('relCategoryId', categoryId);
      if (opts.userId) {
        q.andWhere(
          `NOT EXISTS (SELECT 1 FROM watch_history wh WHERE wh.video_id = v.id AND wh.user_id = :relViewerId)`,
          { relViewerId: opts.userId },
        );
      }
      return q;
    };

    const relevantRows = (await buildBase()
      .addSelect(relevanceSql, 'relevance')
      .addSelect(POPULAR_SCORE_SQL, 'score')
      .andWhere(`${relevanceSql} > 0`)
      .orderBy('relevance', 'DESC')
      .addOrderBy('score', 'DESC')
      .addOrderBy('v.id', 'DESC')
      .limit(limit)
      .getRawMany()) as Array<{ id: string }>;
    const ids = relevantRows.map((r) => r.id);

    if (ids.length < limit) {
      const exclude = [opts.videoId, ...ids];
      const fillRows = (await buildBase()
        .addSelect(POPULAR_SCORE_SQL, 'score')
        .andWhere('v.id NOT IN (:...relExclude)', { relExclude: exclude })
        .orderBy('score', 'DESC')
        .addOrderBy('v.id', 'DESC')
        .limit(limit - ids.length)
        .getRawMany()) as Array<{ id: string }>;
      for (const r of fillRows) if (!ids.includes(r.id)) ids.push(r.id);
    }

    if (!ids.length) {
      return { data: [], meta: { source: opts.videoId } };
    }

    const hydrated = await this.videoRepository.find({
      where: { id: In(ids) },
      relations: ['user', 'skillTags', 'skillTags.subcategory', 'skillTags.subcategory.category'],
    });
    const byId = new Map(hydrated.map((v) => [v.id, v]));
    const data = ids
      .map((id) => byId.get(id))
      .filter((v): v is Video => !!v)
      .map((v) => this.videosService.mapToPublicVideo(v));

    const result = { data, meta: { source: opts.videoId } };

    if (!opts.userId) {
      await safeRedisSetex(this.redis, cacheKey, this.feedCacheTtl(), JSON.stringify(result), this.logger);
    }

    return result;
  }

  /** Bump generation so cached v4 keys expire naturally — avoids Redis KEYS. */
  async invalidateFeedCache(_categoryId?: string) {
    await safeRedisIncr(this.redis, FEED_CACHE_GEN_KEY, this.logger);
  }

  async invalidateVideoDetailCache(videoId: string) {
    await safeRedisDel(this.redis, `video:detail:${videoId}`, this.logger);
  }
}
