import { SelectQueryBuilder } from 'typeorm';
import { Video, VideoStatus, VideoVisibility, ModerationStatus, PublishStatus } from '../content/entities/video.entity';

/** Base filters for public discovery surfaces (feed, search, explore). */
export function applyDiscoverableVideoFilters(
  query: SelectQueryBuilder<Video>,
  alias = 'v',
): SelectQueryBuilder<Video> {
  return query
    .where(`${alias}.status = :status`, { status: VideoStatus.READY })
    .andWhere(`${alias}.publishStatus = :publishStatus`, { publishStatus: PublishStatus.PUBLISHED })
    .andWhere(`${alias}.visibility = :visibility`, { visibility: VideoVisibility.PUBLIC })
    .andWhere(`${alias}.moderationStatus = :mod`, { mod: ModerationStatus.NONE })
    .andWhere(
      `(${alias}.scheduledPublishAt IS NULL OR ${alias}.scheduledPublishAt <= CURRENT_TIMESTAMP)`,
    )
    .andWhere(`(${alias}.publishedAt IS NULL OR ${alias}.publishedAt <= CURRENT_TIMESTAMP)`)
    .andWhere(`${alias}.indexedAt IS NOT NULL`);
}
