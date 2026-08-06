import { FindManyOptions, FindOptionsWhere, ILike, MoreThan } from 'typeorm';
import { Video } from './entities/video.entity';
import { StudioVideosQueryDto, StudioVideoSort } from './dto/studio-videos-query.dto';

export const STUDIO_VIDEOS_DEFAULT_LIMIT = 50;
export const STUDIO_VIDEOS_MAX_LIMIT = 100;

export interface StudioVideoFindOptions {
  where: FindOptionsWhere<Video>;
  order: FindManyOptions<Video>['order'];
  skip: number;
  take: number;
  page: number;
  limit: number;
}

/** Clamp/normalize page (>=1) and limit (1..MAX) from untrusted query input. */
export function normalizeStudioPagination(query: StudioVideosQueryDto): {
  page: number;
  limit: number;
} {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const rawLimit = Math.floor(query.limit ?? STUDIO_VIDEOS_DEFAULT_LIMIT);
  const limit = Math.min(Math.max(1, rawLimit), STUDIO_VIDEOS_MAX_LIMIT);
  return { page, limit };
}

/**
 * Build TypeORM find options for a creator's Studio content library. Pure and
 * side-effect free so it can be unit-tested without the full service graph.
 * Always scoped to the owner's userId; filters/sort are optional.
 */
export function buildStudioVideoFindOptions(
  userId: string,
  query: StudioVideosQueryDto = {},
): StudioVideoFindOptions {
  const { page, limit } = normalizeStudioPagination(query);

  const where: FindOptionsWhere<Video> = { userId };
  if (query.status) where.status = query.status;
  if (query.visibility) where.visibility = query.visibility;
  if (query.categoryId) where.categoryId = query.categoryId;
  const search = query.search?.trim();
  if (search) where.title = ILike(`%${search}%`);
  if (query.scheduled) {
    where.scheduledPublishAt = MoreThan(new Date());
  }

  let order: FindManyOptions<Video>['order'];
  switch (query.sort) {
    case StudioVideoSort.OLDEST:
      order = { createdAt: 'ASC' };
      break;
    case StudioVideoSort.VIEWS:
      order = { viewCount: 'DESC', createdAt: 'DESC' };
      break;
    case StudioVideoSort.TITLE:
      order = { title: 'ASC' };
      break;
    case StudioVideoSort.RECENT:
    default:
      order = { createdAt: 'DESC' };
  }

  return { where, order, skip: (page - 1) * limit, take: limit, page, limit };
}
