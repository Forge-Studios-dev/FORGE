import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { isSkillEconomyLmsEnabled } from '../../common/features/skill-economy-lms';
import { EngagementService } from '../engagement/engagement.service';

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

const YOUTUBE_DEFAULT_TYPES: ContentType[] = ['video', 'short'];
const LMS_DEFAULT_TYPES: ContentType[] = ['video', 'short', 'podcast', 'course', 'live'];

/** Accept any RFC-4122 UUID shape (v1–v5). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertOptionalUuid(value: string | undefined, field: string): void {
  if (value == null || value === '') return;
  if (!UUID_RE.test(value)) {
    throw new BadRequestException(`Invalid ${field}`);
  }
}

@Injectable()
export class ContentLibraryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly engagementService: EngagementService,
  ) {}

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
    assertOptionalUuid(options.creatorId, 'creatorId');
    assertOptionalUuid(options.categoryId, 'categoryId');

    const limit = Math.min(options.limit ?? 24, 60);
    const offset = options.offset ?? 0;
    const defaults = isSkillEconomyLmsEnabled() ? LMS_DEFAULT_TYPES : YOUTUBE_DEFAULT_TYPES;
    let types = options.contentTypes ?? defaults;
    if (!isSkillEconomyLmsEnabled()) {
      types = types.filter((t) => t === 'video' || t === 'short' || t === 'live');
    }
    const orderBy =
      options.orderBy === 'popular' ? 'v.view_count DESC' :
      options.orderBy === 'trending' ? 'recent_views DESC NULLS LAST, v.view_count DESC' :
      'v.created_at DESC';

    const filterParams: unknown[] = [];
    let creatorFilter = '';
    if (options.creatorId) {
      filterParams.push(options.creatorId);
      creatorFilter = `AND v.user_id = $${filterParams.length}`;
    }
    let categoryFilter = '';
    if (options.categoryId) {
      filterParams.push(options.categoryId);
      categoryFilter = `AND v.category_id = $${filterParams.length}`;
    }

    // Map frontend content types to DB video_types (enum literals only — never user input)
    const videoTypes: string[] = [];
    if (types.includes('video')) videoTypes.push(`'video'`);
    if (types.includes('short')) videoTypes.push(`'short'`);
    if (types.includes('podcast')) videoTypes.push(`'podcast'`);
    const videoTypeFilter = videoTypes.length
      ? `AND v.video_type IN (${videoTypes.join(',')})`
      : `AND v.video_type IN ('video','short')`;

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
        WHERE watched_at > NOW() - INTERVAL '7 days' GROUP BY video_id
      ) wh ON wh.video_id = v.id
      WHERE v.publish_status = 'published'
        AND v.status = 'ready'
        AND v.visibility = 'public'
        ${videoTypeFilter}
        ${creatorFilter}
        ${categoryFilter}
    `;

    const limitIdx = filterParams.length + 1;
    const offsetIdx = filterParams.length + 2;
    const pageParams = [...filterParams, limit, offset];

    const rows = await this.dataSource.query<ContentLibraryItem[]>(
      `${videosQuery} ORDER BY ${orderBy} LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      pageParams,
    );

    const [{ total }] = await this.dataSource.query<[{ total: string }]>(
      `SELECT COUNT(*) as total FROM (${videosQuery}) sub`,
      filterParams,
    );

    return { data: rows, total: parseInt(total, 10) };
  }

  async getCreatorLibrary(
    creatorId: string,
    viewerId?: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    if (
      viewerId &&
      (await this.engagementService.isBlockedEitherWay(viewerId, creatorId))
    ) {
      throw new ForbiddenException('This channel is not available');
    }
    return this.getUnifiedLibrary(viewerId, {
      creatorId,
      limit: options.limit,
      offset: options.offset,
      orderBy: 'recent',
    });
  }
}
