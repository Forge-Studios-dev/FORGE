import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type ContentType = 'video' | 'short' | 'podcast' | 'course' | 'live';

export interface ContentLibraryItem {
  id: string;
  contentType: ContentType;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  creatorId: string;
  categoryId: string | null;
  viewCount: number;
  publishedAt: Date;
  requiredTierId: string | null;
}

@Injectable()
export class ContentLibraryService {
  constructor(private readonly dataSource: DataSource) {}

  async getUnifiedLibrary(
    viewerId: string | undefined,
    options: {
      creatorId?: string;
      contentTypes?: ContentType[];
      categoryId?: string;
      limit?: number;
      offset?: number;
      orderBy?: 'recent' | 'popular' | 'trending';
    },
  ): Promise<{ data: ContentLibraryItem[]; total: number }> {
    const limit = Math.min(options.limit ?? 24, 60);
    const offset = options.offset ?? 0;
    const types = options.contentTypes ?? ['video', 'short', 'podcast', 'course', 'live'];
    const orderBy =
      options.orderBy === 'popular' ? 'v.view_count DESC' :
      options.orderBy === 'trending' ? 'recent_views DESC NULLS LAST, v.view_count DESC' :
      'v.created_at DESC';

    const creatorFilter = options.creatorId ? `AND v.user_id = '${options.creatorId}'` : '';
    const categoryFilter = options.categoryId ? `AND v.category_id = '${options.categoryId}'` : '';

    // Map frontend content types to DB video_types
    const videoTypes: string[] = [];
    if (types.includes('video')) videoTypes.push(`'video'`);
    if (types.includes('short')) videoTypes.push(`'short'`);
    if (types.includes('podcast')) videoTypes.push(`'podcast'`);
    const videoTypeFilter = videoTypes.length
      ? `AND v.video_type IN (${videoTypes.join(',')})`
      : `AND v.video_type IN ('video','short','podcast')`;

    // Union query: videos + (optionally) live VODs + courses
    const videosQuery = `
      SELECT v.id, v.video_type as "contentType", v.title, v.description,
             v.thumbnail_url as "thumbnailUrl", v.duration,
             v.user_id as "creatorId", v.category_id as "categoryId",
             v.view_count as "viewCount", v.created_at as "publishedAt",
             v.required_tier_id as "requiredTierId",
             COALESCE(wh.recent_views, 0) as recent_views
      FROM videos v
      LEFT JOIN (
        SELECT video_id, COUNT(*) as recent_views FROM watch_history
        WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY video_id
      ) wh ON wh.video_id = v.id
      WHERE v.publish_status = 'published'
        AND v.status = 'ready'
        AND v.visibility = 'public'
        ${videoTypeFilter}
        ${creatorFilter}
        ${categoryFilter}
    `;

    // For now, serve unified video/short/podcast only; course integration can reuse this pattern
    const rows = await this.dataSource.query<ContentLibraryItem[]>(
      `${videosQuery} ORDER BY ${orderBy} LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const [{ total }] = await this.dataSource.query<[{ total: string }]>(
      `SELECT COUNT(*) as total FROM (${videosQuery}) sub`,
      [],
    );

    return { data: rows, total: parseInt(total, 10) };
  }

  async getCreatorLibrary(
    creatorId: string,
    viewerId?: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    return this.getUnifiedLibrary(viewerId, {
      creatorId,
      limit: options.limit,
      offset: options.offset,
      orderBy: 'recent',
    });
  }
}
