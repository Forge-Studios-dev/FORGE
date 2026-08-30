import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { safeRedisGet, safeRedisSetex } from '../../common/redis/redis-safe.util';
import { getMutedChannelIds, getNotInterestedVideoIds } from '../feed/not-interested.util';
import { mergeExcludedCreatorIds } from '../feed/viewer-exclusions.util';
import { diversifyByCreator, applyExplorationBudget } from '../feed/feed-diversity.util';
import { getSessionCreatorIds } from '../feed/session-watch.util';
import { EngagementService } from '../engagement/engagement.service';

export interface RecommendedVideo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  duration: number | null;
  viewCount: number;
  userId: string;
  categoryId: string | null;
  score: number;
  reason: 'watched_similar' | 'same_category' | 'followed_creator' | 'trending' | 'exploration' | 'session_affinity';
}

const TRENDING_CACHE_TTL_SEC = 60;

/** Map API window query to hours. Default week (168h). */
export function parseTrendingWindowHours(window?: string | null): number {
  const w = (window ?? '').trim().toLowerCase();
  if (w === 'now' || w === '24h' || w === 'day') return 24;
  if (w === 'week' || w === '7d' || w === '') return 168;
  const asNum = Number(w);
  if (Number.isFinite(asNum) && asNum > 0) return Math.min(336, Math.max(6, Math.floor(asNum)));
  return 168;
}

/**
 * Raw-SQL equivalent of feed-query.util.ts's applyDiscoverableVideoFilters —
 * this service can't use that QueryBuilder helper directly since these are
 * multi-CTE dataSource.query() calls, not SelectQueryBuilders. Every one of
 * these predicates matters: without them a moderator-held video, a video
 * scheduled for a future premiere, or one that hasn't finished search
 * indexing yet can still surface via recommendations/trending even though
 * every other discovery surface (feed, search) already excludes it.
 */
const DISCOVERABLE_VIDEO_SQL = `
        AND v.moderation_status = 'none'
        AND (v.scheduled_publish_at IS NULL OR v.scheduled_publish_at <= CURRENT_TIMESTAMP)
        AND (v.published_at IS NULL OR v.published_at <= CURRENT_TIMESTAMP)
        AND v.indexed_at IS NOT NULL`;

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRedis() private readonly redis: Redis,
    private readonly engagementService: EngagementService,
  ) {}

  /**
   * Generate personalized video recommendations using a multi-signal SQL query:
   * 1. Category affinity (from watch history + 2h session boost)
   * 2. Followed creator content
   * 3. Session creator dwell (Redis, last 2h of meaningful watches)
   * 4. Trending content (high recent view velocity)
   * 5. First-page exploration budget (~15%) outside follow/category bubble
   */
  async getPersonalizedFeed(
    userId: string,
    options: { limit?: number; offset?: number; excludeVideoIds?: string[] },
  ): Promise<{ data: RecommendedVideo[]; total: number }> {
    const limit = Math.min(options.limit ?? 20, 50);
    const offset = options.offset ?? 0;
    const excludeIds = options.excludeVideoIds ?? [];

    // Get user's top categories from watch history
    const topCategories = await this.dataSource.query<{ category_id: string; watch_count: string }[]>(
      `SELECT v.category_id, COUNT(*) as watch_count
       FROM watch_history wh
       JOIN videos v ON v.id = wh.video_id
       WHERE wh.user_id = $1 AND v.category_id IS NOT NULL
       GROUP BY v.category_id
       ORDER BY watch_count DESC
       LIMIT 5`,
      [userId],
    );
    let categoryIds = topCategories.map((r) => r.category_id);

    // Session signal: categories watched in the last 2 hours float to the front
    // of the affinity list so this sitting outweighs long-term history (YouTube-like).
    const sessionCategories = await this.dataSource.query<{ category_id: string }[]>(
      `SELECT v.category_id
       FROM watch_history wh
       JOIN videos v ON v.id = wh.video_id
       WHERE wh.user_id = $1
         AND v.category_id IS NOT NULL
         AND wh.watched_at > NOW() - INTERVAL '2 hours'
       GROUP BY v.category_id
       ORDER BY MAX(wh.watched_at) DESC
       LIMIT 3`,
      [userId],
    );
    if (sessionCategories.length) {
      const sessionIds = sessionCategories.map((r) => r.category_id);
      categoryIds = [...new Set([...sessionIds, ...categoryIds])].slice(0, 5);
    }

    // Cold-start: seed from onboarding interests when watch history has no categories
    if (!categoryIds.length) {
      const raw = await safeRedisGet(this.redis, `user:interests:${userId}`, this.logger);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            categoryIds = parsed.filter((x): x is string => typeof x === 'string').slice(0, 5);
          }
        } catch {
          /* ignore */
        }
      }
    }

    // Get already-watched video IDs (last 200)
    const watched = await this.dataSource.query<{ video_id: string }[]>(
      `SELECT video_id FROM watch_history WHERE user_id = $1 ORDER BY watched_at DESC LIMIT 200`,
      [userId],
    );
    const watchedIds = [
      ...new Set([...watched.map((r) => r.video_id), ...excludeIds]),
    ];
    const notInterested = await getNotInterestedVideoIds(this.redis, userId, this.logger);
    for (const id of notInterested) {
      if (!watchedIds.includes(id)) watchedIds.push(id);
    }
    const mutedChannels = await getMutedChannelIds(this.redis, userId, this.logger);
    const blockedPeers = await this.engagementService.getBlockedPeerIds(userId);
    const excludedCreators = mergeExcludedCreatorIds(mutedChannels, blockedPeers);
    const sessionCreatorIds = await getSessionCreatorIds(this.redis, userId, this.logger);
    const nullUuid = '00000000-0000-0000-0000-000000000000';

    // Compose the recommendation query with score signals
    // $1 user, $2 categories, $3 session creators, then exclude/mute/limit/offset
    const excludeClause = watchedIds.length
      ? `AND v.id NOT IN (${watchedIds.map((_, i) => `$${i + 4}`).join(',')})`
      : '';
    const muteStart = watchedIds.length + 4;
    const muteClause = excludedCreators.length
      ? `AND v.user_id NOT IN (${excludedCreators.map((_, i) => `$${muteStart + i}`).join(',')})`
      : '';
    const limitParam = muteStart + excludedCreators.length;
    const offsetParam = limitParam + 1;

    const query = `
      WITH trending AS (
        SELECT video_id, COUNT(*) as recent_views
        FROM watch_history
        WHERE watched_at > NOW() - INTERVAL '7 days'
        GROUP BY video_id
      ),
      followed_creators AS (
        SELECT following_id as creator_id FROM follows WHERE follower_id = $1
      ),
      category_affinities AS (
        SELECT unnest($2::uuid[]) as category_id, generate_series(1, array_length($2::uuid[], 1)) as rank
      ),
      session_creators AS (
        SELECT unnest($3::uuid[]) as creator_id
      )
      SELECT DISTINCT
        v.id,
        v.title,
        v.thumbnail_url as "thumbnailUrl",
        v.duration,
        v.view_count as "viewCount",
        v.user_id as "userId",
        v.category_id as "categoryId",
        (
          CASE WHEN fc.creator_id IS NOT NULL THEN 40 ELSE 0 END
          + CASE WHEN sc.creator_id IS NOT NULL THEN 25 ELSE 0 END
          + CASE WHEN ca.category_id IS NOT NULL THEN (20 - LEAST(ca.rank, 5) * 3) ELSE 0 END
          + LEAST(COALESCE(t.recent_views, 0)::int, 20)
          + CASE WHEN v.created_at > NOW() - INTERVAL '14 days' THEN 10 ELSE 0 END
        ) as score,
        CASE
          WHEN fc.creator_id IS NOT NULL THEN 'followed_creator'
          WHEN sc.creator_id IS NOT NULL THEN 'session_affinity'
          WHEN ca.category_id IS NOT NULL THEN 'same_category'
          WHEN t.recent_views IS NOT NULL THEN 'trending'
          ELSE 'trending'
        END as reason
      FROM videos v
      LEFT JOIN trending t ON t.video_id = v.id
      LEFT JOIN followed_creators fc ON fc.creator_id = v.user_id
      LEFT JOIN session_creators sc ON sc.creator_id = v.user_id
      LEFT JOIN category_affinities ca ON ca.category_id = v.category_id
      WHERE v.publish_status = 'published'
        AND v.status = 'ready'
        AND v.visibility = 'public'${DISCOVERABLE_VIDEO_SQL}
        AND v.user_id != $1
        ${excludeClause}
        ${muteClause}
        AND (
          fc.creator_id IS NOT NULL
          OR sc.creator_id IS NOT NULL
          OR ca.category_id IS NOT NULL
          OR t.recent_views >= 3
        )
      ORDER BY score DESC, v.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const params: unknown[] = [
      userId,
      categoryIds.length ? categoryIds : [nullUuid],
      sessionCreatorIds.length ? sessionCreatorIds : [nullUuid],
      ...watchedIds,
      ...excludedCreators,
      limit,
      offset,
    ];

    const rows = await this.dataSource.query<RecommendedVideo[]>(query, params);

    // Fallback: if not enough personalized results, fill with trending
    if (rows.length < limit) {
      const fallback = await this.getTrending(userId, limit - rows.length, [
        ...watchedIds,
      ]);
      const existingIds = new Set(rows.map((r) => r.id));
      const muted = new Set(excludedCreators);
      for (const f of fallback) {
        if (!existingIds.has(f.id) && !muted.has(f.userId)) rows.push(f);
      }
    }

    // Exploration budget: weave in creators outside follow/category affinity
    // (first page only — offset pages already paginate the affinity ranking).
    if (offset === 0 && rows.length >= 4) {
      const exploration = await this.getExplorationCandidates(userId, {
        limit: Math.max(3, Math.ceil(limit * 0.25)),
        excludeVideoIds: [...watchedIds, ...rows.map((r) => r.id)],
        excludeCreatorIds: excludedCreators,
        affinityCategoryIds: categoryIds,
      });
      const mixed = applyExplorationBudget(rows, exploration, { ratio: 0.15, skipFirst: 3 });
      const diversified = diversifyByCreator(mixed.slice(0, limit), 2);
      return { data: diversified, total: diversified.length };
    }

    const diversified = diversifyByCreator(rows.slice(0, limit), 2);
    return { data: diversified, total: diversified.length };
  }

  /**
   * Fresh / lightly trending videos from creators the viewer does not follow
   * and categories outside their affinity — used for forYou exploration slots.
   */
  private async getExplorationCandidates(
    userId: string,
    opts: {
      limit: number;
      excludeVideoIds: string[];
      excludeCreatorIds: string[];
      affinityCategoryIds: string[];
    },
  ): Promise<RecommendedVideo[]> {
    const take = Math.min(Math.max(opts.limit, 1), 20);
    const excludeIds = opts.excludeVideoIds;
    const excludeCreators = opts.excludeCreatorIds;
    const affinityCats = opts.affinityCategoryIds.filter(Boolean);

    const videoExclude = excludeIds.length
      ? `AND v.id NOT IN (${excludeIds.map((_, i) => `$${i + 2}`).join(',')})`
      : '';
    const creatorStart = excludeIds.length + 2;
    const creatorExclude = excludeCreators.length
      ? `AND v.user_id NOT IN (${excludeCreators.map((_, i) => `$${creatorStart + i}`).join(',')})`
      : '';
    const catStart = creatorStart + excludeCreators.length;
    const catExclude = affinityCats.length
      ? `AND (v.category_id IS NULL OR v.category_id NOT IN (${affinityCats
          .map((_, i) => `$${catStart + i}`)
          .join(',')}))`
      : '';
    const limitParam = catStart + affinityCats.length;

    const query = `
      SELECT v.id, v.title, v.thumbnail_url as "thumbnailUrl", v.duration,
             v.view_count as "viewCount", v.user_id as "userId",
             v.category_id as "categoryId",
             COALESCE(wh.recent_views, 0) + CASE WHEN v.created_at > NOW() - INTERVAL '14 days' THEN 15 ELSE 0 END as score,
             'exploration'::text as reason
      FROM videos v
      LEFT JOIN (
        SELECT video_id, COUNT(*) as recent_views
        FROM watch_history
        WHERE watched_at > NOW() - INTERVAL '7 days'
        GROUP BY video_id
      ) wh ON wh.video_id = v.id
      WHERE v.publish_status = 'published'
        AND v.status = 'ready'
        AND v.visibility = 'public'${DISCOVERABLE_VIDEO_SQL}
        AND v.user_id != $1
        AND v.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = $1)
        ${videoExclude}
        ${creatorExclude}
        ${catExclude}
      ORDER BY score DESC, v.created_at DESC
      LIMIT $${limitParam}
    `;

    const params: unknown[] = [userId, ...excludeIds, ...excludeCreators, ...affinityCats, take];
    return this.dataSource.query<RecommendedVideo[]>(query, params);
  }

  /**
   * Global trending by recent watch velocity.
   * @param windowHours 24 = "Now", 168 = "This week" (default). Clamped 6–336.
   */
  async getTrending(
    excludeUserId?: string,
    limit = 20,
    excludeIds: string[] = [],
    windowHours = 168,
  ): Promise<RecommendedVideo[]> {
    const capped = Math.min(Math.max(limit, 1), 50);
    const hours = Math.min(336, Math.max(6, Math.floor(windowHours) || 168));
    // Anonymous/global trending only — personalized exclusions skip cache.
    const cacheable = !excludeUserId && excludeIds.length === 0;
    const cacheKey = `recs:trending:v2:${hours}h:${capped}`;
    if (cacheable) {
      const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
      if (cached) {
        try {
          return JSON.parse(cached) as RecommendedVideo[];
        } catch {
          /* fall through */
        }
      }
    }

    const excludeClause = excludeIds.length
      ? `AND v.id NOT IN (${excludeIds.map((_, i) => `$${i + (excludeUserId ? 4 : 3)}`).join(',')})`
      : '';
    const userExclude = excludeUserId ? `AND v.user_id != $3` : '';

    const query = `
      SELECT v.id, v.title, v.thumbnail_url as "thumbnailUrl", v.duration,
             v.view_count as "viewCount", v.user_id as "userId",
             v.category_id as "categoryId",
             COALESCE(wh.recent_views, 0) + v.view_count / 100 as score,
             'trending'::text as reason
      FROM videos v
      LEFT JOIN (
        SELECT video_id, COUNT(*) as recent_views
        FROM watch_history
        WHERE watched_at > NOW() - ($2::int * INTERVAL '1 hour')
        GROUP BY video_id
      ) wh ON wh.video_id = v.id
      WHERE v.publish_status = 'published'
        AND v.status = 'ready'
        AND v.visibility = 'public'${DISCOVERABLE_VIDEO_SQL}
        ${userExclude}
        ${excludeClause}
      ORDER BY score DESC, v.created_at DESC
      LIMIT $1
    `;

    const params: unknown[] = [
      capped,
      hours,
      ...(excludeUserId ? [excludeUserId] : []),
      ...excludeIds,
    ];

    const rows = await this.dataSource.query<RecommendedVideo[]>(query, params);
    if (cacheable) {
      await safeRedisSetex(
        this.redis,
        cacheKey,
        TRENDING_CACHE_TTL_SEC,
        JSON.stringify(rows),
        this.logger,
      );
    }
    return rows;
  }

  async getSimilarVideos(
    videoId: string,
    limit = 10,
    viewerId?: string | null,
  ): Promise<RecommendedVideo[]> {
    const capped = Math.min(Math.max(limit, 1), 50);
    const mutedChannels = viewerId
      ? await getMutedChannelIds(this.redis, viewerId, this.logger)
      : [];
    const blockedPeers = viewerId
      ? await this.engagementService.getBlockedPeerIds(viewerId)
      : [];
    const excludedCreators = mergeExcludedCreatorIds(mutedChannels, blockedPeers);

    const excludeClause = excludedCreators.length
      ? `AND v.user_id NOT IN (${excludedCreators.map((_, i) => `$${i + 3}`).join(',')})`
      : '';

    return this.dataSource.query<RecommendedVideo[]>(
      `SELECT v.id, v.title, v.thumbnail_url as "thumbnailUrl", v.duration,
              v.view_count as "viewCount", v.user_id as "userId",
              v.category_id as "categoryId", v.view_count as score,
              'same_category'::text as reason
       FROM videos v
       JOIN videos src ON src.id = $1
       WHERE v.category_id = src.category_id
         AND v.id != $1
         AND v.publish_status = 'published'
         AND v.status = 'ready'
         AND v.visibility = 'public'${DISCOVERABLE_VIDEO_SQL}
         ${excludeClause}
       ORDER BY v.view_count DESC, v.created_at DESC
       LIMIT $2`,
      [videoId, capped, ...excludedCreators],
    );
  }
}
