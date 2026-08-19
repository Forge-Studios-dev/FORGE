import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { safeRedisGet, safeRedisSetex } from '../../common/redis/redis-safe.util';
import { getMutedChannelIds, getNotInterestedVideoIds } from '../feed/not-interested.util';
import { mergeExcludedCreatorIds } from '../feed/viewer-exclusions.util';
import { diversifyByCreator } from '../feed/feed-diversity.util';
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
  reason: 'watched_similar' | 'same_category' | 'followed_creator' | 'trending';
}

const TRENDING_CACHE_TTL_SEC = 60;

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
   * 1. Category affinity (from watch history)
   * 2. Followed creator content
   * 3. Trending content (high recent view velocity)
   * 4. Skill tag overlap with watched content
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
      `SELECT video_id FROM watch_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
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

    // Compose the recommendation query with score signals
    const excludeClause = watchedIds.length
      ? `AND v.id NOT IN (${watchedIds.map((_, i) => `$${i + 3}`).join(',')})`
      : '';
    const muteStart = watchedIds.length + 3;
    const muteClause = excludedCreators.length
      ? `AND v.user_id NOT IN (${excludedCreators.map((_, i) => `$${muteStart + i}`).join(',')})`
      : '';
    const limitParam = muteStart + excludedCreators.length;
    const offsetParam = limitParam + 1;

    const query = `
      WITH trending AS (
        SELECT video_id, COUNT(*) as recent_views
        FROM watch_history
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY video_id
      ),
      followed_creators AS (
        SELECT following_id as creator_id FROM follows WHERE follower_id = $1
      ),
      category_affinities AS (
        SELECT unnest($2::uuid[]) as category_id, generate_series(1, array_length($2::uuid[], 1)) as rank
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
          + CASE WHEN ca.category_id IS NOT NULL THEN (20 - LEAST(ca.rank, 5) * 3) ELSE 0 END
          + LEAST(COALESCE(t.recent_views, 0)::int, 20)
          + CASE WHEN v.created_at > NOW() - INTERVAL '14 days' THEN 10 ELSE 0 END
        ) as score,
        CASE
          WHEN fc.creator_id IS NOT NULL THEN 'followed_creator'
          WHEN ca.category_id IS NOT NULL THEN 'same_category'
          WHEN t.recent_views IS NOT NULL THEN 'trending'
          ELSE 'trending'
        END as reason
      FROM videos v
      LEFT JOIN trending t ON t.video_id = v.id
      LEFT JOIN followed_creators fc ON fc.creator_id = v.user_id
      LEFT JOIN category_affinities ca ON ca.category_id = v.category_id
      WHERE v.publish_status = 'published'
        AND v.status = 'ready'
        AND v.visibility = 'public'${DISCOVERABLE_VIDEO_SQL}
        AND v.user_id != $1
        ${excludeClause}
        ${muteClause}
        AND (
          fc.creator_id IS NOT NULL
          OR ca.category_id IS NOT NULL
          OR t.recent_views >= 3
        )
      ORDER BY score DESC, v.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const params: unknown[] = [
      userId,
      categoryIds.length ? categoryIds : ['00000000-0000-0000-0000-000000000000'],
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

    const diversified = diversifyByCreator(rows.slice(0, limit), 2);
    return { data: diversified, total: diversified.length };
  }

  async getTrending(
    excludeUserId?: string,
    limit = 20,
    excludeIds: string[] = [],
  ): Promise<RecommendedVideo[]> {
    const capped = Math.min(Math.max(limit, 1), 50);
    // Anonymous/global trending only — personalized exclusions skip cache.
    const cacheable = !excludeUserId && excludeIds.length === 0;
    const cacheKey = `recs:trending:v1:${capped}`;
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
      ? `AND v.id NOT IN (${excludeIds.map((_, i) => `$${i + (excludeUserId ? 3 : 2)}`).join(',')})`
      : '';
    const userExclude = excludeUserId ? `AND v.user_id != $2` : '';

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
        WHERE created_at > NOW() - INTERVAL '7 days'
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
