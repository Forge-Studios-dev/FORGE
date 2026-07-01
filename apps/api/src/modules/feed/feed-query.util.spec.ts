import { SelectQueryBuilder } from 'typeorm';
import {
  ModerationStatus,
  PublishStatus,
  Video,
  VideoStatus,
  VideoVisibility,
} from '../content/entities/video.entity';
import { applyDiscoverableVideoFilters } from './feed-query.util';

type MockQb = SelectQueryBuilder<Video> & {
  calls: { method: string; args: unknown[] }[];
};

describe('applyDiscoverableVideoFilters', () => {
  function createQueryBuilder(): MockQb {
    const calls: { method: string; args: unknown[] }[] = [];
    const self: MockQb = {
      calls,
      where: jest.fn((...args: unknown[]) => {
        calls.push({ method: 'where', args });
        return self;
      }),
      andWhere: jest.fn((...args: unknown[]) => {
        calls.push({ method: 'andWhere', args });
        return self;
      }),
    } as unknown as MockQb;
    return self;
  }

  it('filters to ready, published, public, unmoderated, indexed videos', () => {
    const qb = createQueryBuilder();
    applyDiscoverableVideoFilters(qb);

    expect(qb.where).toHaveBeenCalledWith('v.status = :status', { status: VideoStatus.READY });
    expect(qb.andWhere).toHaveBeenCalledWith('v.publish_status = :publishStatus', {
      publishStatus: PublishStatus.PUBLISHED,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('v.visibility = :visibility', {
      visibility: VideoVisibility.PUBLIC,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('v.moderation_status = :mod', {
      mod: ModerationStatus.NONE,
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      '(v.scheduled_publish_at IS NULL OR v.scheduled_publish_at <= CURRENT_TIMESTAMP)',
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      '(v.published_at IS NULL OR v.published_at <= CURRENT_TIMESTAMP)',
    );
    expect(qb.andWhere).toHaveBeenCalledWith('v.indexed_at IS NOT NULL');
  });

  it('supports custom table alias', () => {
    const qb = createQueryBuilder();
    applyDiscoverableVideoFilters(qb, 'video');
    expect(qb.where).toHaveBeenCalledWith('video.status = :status', { status: VideoStatus.READY });
  });
});
