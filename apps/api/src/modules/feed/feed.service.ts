import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Video } from '../content/entities/video.entity';
import { applyDiscoverableVideoFilters } from './feed-query.util';
import { VideosService } from '../content/videos.service';
import { Follow } from '../engagement/entities/follow.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { Category } from '../categories/entities/category.entity';

const FEED_CACHE_TTL_BASE = 300;
const FEED_CACHE_JITTER_SEC = 60;

/** SQL expression — must match ordering for popular / forYou base component. */
export const POPULAR_SCORE_SQL = `(v.view_count * 0.6 + v.like_count * 0.3 + (EXTRACT(EPOCH FROM v.created_at) / 86400) * 0.1)`;

/** Sort key for latest/popular/forYou tie-break (use addSelect alias — not raw orderBy). */
export const SORT_TIME_SQL = 'COALESCE(v.published_at, v.created_at)';

export type FeedSort = 'latest' | 'popular' | 'forYou';

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
  ) {}

  private feedCacheTtl(): number {
    return FEED_CACHE_TTL_BASE + Math.floor(Math.random() * FEED_CACHE_JITTER_SEC);
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
    const cacheKey = `feed:v3:${sort}:${categoryId || options.categorySlug || 'all'}:${skillKey}:${options.cursor || 'start'}:${limit}`;

    const cached = await this.redis.get(cacheKey);
    if (cached && !options.userId && sort !== 'forYou') {
      return JSON.parse(cached);
    }

    let followingIds: string[] = [];
    let affinityIds: string[] = [];
    if (sort === 'forYou' && options.userId) {
      const followingRows = await this.followRepository.find({
        where: { followerId: options.userId },
        select: ['followingId'],
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
      this.videoRepository
        .createQueryBuilder('v')
        .leftJoinAndSelect('v.user', 'creator')
        .leftJoinAndSelect('v.skillTags', 'skillTags')
        .leftJoinAndSelect('skillTags.subcategory', 'subcategory')
        .leftJoinAndSelect('subcategory.category', 'category'),
    ).take(limit + 1);

    if (categoryId) {
      query.andWhere('(v.category_id = :categoryId OR category.id = :categoryId)', {
        categoryId,
      });
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

    query.addSelect(SORT_TIME_SQL, 'sortTime');

    if (sort === 'popular') {
      query.addSelect(POPULAR_SCORE_SQL, 'score');
      query
        .orderBy('score', 'DESC')
        .addOrderBy('sortTime', 'DESC')
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
      query.addSelect(personSql, 'personScore');
      query
        .orderBy('personScore', 'DESC')
        .addOrderBy('sortTime', 'DESC')
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
      query.orderBy('sortTime', 'DESC').addOrderBy('v.id', 'DESC');
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

    const videos = await query.getMany();
    const hasMore = videos.length > limit;
    const data = hasMore ? videos.slice(0, limit) : videos;

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
      await this.redis.setex(cacheKey, this.feedCacheTtl(), JSON.stringify(result));
    }

    return result;
  }

  async invalidateFeedCache(categoryId?: string) {
    const patterns = categoryId
      ? [`feed:v3:*:${categoryId}:*`, `feed:*:${categoryId}:*`]
      : ['feed:v3:*', 'feed:*'];
    const keys = new Set<string>();
    for (const pattern of patterns) {
      const found = await this.redis.keys(pattern);
      found.forEach((k) => keys.add(k));
    }
    if (keys.size > 0) {
      await this.redis.del(...keys);
    }
  }

  async invalidateVideoDetailCache(videoId: string) {
    await this.redis.del(`video:detail:${videoId}`);
  }
}
