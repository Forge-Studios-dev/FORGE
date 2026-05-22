import { SelectQueryBuilder } from 'typeorm';
import { Video, VideoStatus, VideoVisibility, ModerationStatus, PublishStatus } from '../content/entities/video.entity';

/** Base filters for public discovery surfaces (feed, search, explore). */
export function applyDiscoverableVideoFilters(
  query: SelectQueryBuilder<Video>,
  alias = 'v',
): SelectQueryBuilder<Video> {
  return query
    .where(`${alias}.status = :status`, { status: VideoStatus.READY })
    .andWhere(`${alias}.publish_status = :publishStatus`, {
      publishStatus: PublishStatus.PUBLISHED,
    })
    .andWhere(`${alias}.visibility = :visibility`, { visibility: VideoVisibility.PUBLIC })
    .andWhere(`${alias}.moderation_status = :mod`, { mod: ModerationStatus.NONE })
    .andWhere(
      `(${alias}.scheduled_publish_at IS NULL OR ${alias}.scheduled_publish_at <= CURRENT_TIMESTAMP)`,
    )
    .andWhere(`(${alias}.published_at IS NULL OR ${alias}.published_at <= CURRENT_TIMESTAMP)`)
    .andWhere(`${alias}.indexed_at IS NOT NULL`);
}
