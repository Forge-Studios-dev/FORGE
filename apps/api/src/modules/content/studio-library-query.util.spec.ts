import { FindOperator } from 'typeorm';
import {
  buildStudioVideoFindOptions,
  normalizeStudioPagination,
  STUDIO_VIDEOS_DEFAULT_LIMIT,
  STUDIO_VIDEOS_MAX_LIMIT,
} from './studio-library-query.util';
import { StudioVideoSort } from './dto/studio-videos-query.dto';
import { VideoStatus, VideoVisibility } from './entities/video.entity';

describe('normalizeStudioPagination', () => {
  it('defaults to page 1 and the default limit', () => {
    expect(normalizeStudioPagination({})).toEqual({
      page: 1,
      limit: STUDIO_VIDEOS_DEFAULT_LIMIT,
    });
  });

  it('clamps limit to the max', () => {
    expect(normalizeStudioPagination({ limit: 5000 }).limit).toBe(STUDIO_VIDEOS_MAX_LIMIT);
  });

  it('floors limit to at least 1 and page to at least 1', () => {
    expect(normalizeStudioPagination({ limit: 0, page: 0 })).toEqual({ page: 1, limit: 1 });
    expect(normalizeStudioPagination({ page: -3 }).page).toBe(1);
  });
});

describe('buildStudioVideoFindOptions', () => {
  it('always scopes to the owner and defaults to newest-first', () => {
    const opts = buildStudioVideoFindOptions('user-1', {});
    expect(opts.where).toEqual({ userId: 'user-1' });
    expect(opts.order).toEqual({ createdAt: 'DESC' });
    expect(opts.skip).toBe(0);
    expect(opts.take).toBe(STUDIO_VIDEOS_DEFAULT_LIMIT);
  });

  it('applies status/visibility/category filters', () => {
    const opts = buildStudioVideoFindOptions('user-1', {
      status: VideoStatus.READY,
      visibility: VideoVisibility.SUBSCRIBERS,
      categoryId: 'cat-9',
    });
    expect(opts.where).toMatchObject({
      userId: 'user-1',
      status: VideoStatus.READY,
      visibility: VideoVisibility.SUBSCRIBERS,
      categoryId: 'cat-9',
    });
  });

  it('filters to future scheduled publishes when scheduled=true', () => {
    const opts = buildStudioVideoFindOptions('user-1', { scheduled: true });
    expect(opts.where.userId).toBe('user-1');
    const op = opts.where.scheduledPublishAt as FindOperator<Date>;
    expect(op).toBeInstanceOf(FindOperator);
    expect(op.type).toBe('moreThan');
  });

  it('builds a case-insensitive title search', () => {
    const opts = buildStudioVideoFindOptions('user-1', { search: '  Guitar  ' });
    const title = opts.where.title as unknown as FindOperator<string>;
    expect(title).toBeInstanceOf(FindOperator);
    expect(title.value).toBe('%Guitar%');
  });

  it('ignores blank search', () => {
    const opts = buildStudioVideoFindOptions('user-1', { search: '   ' });
    expect(opts.where.title).toBeUndefined();
  });

  it.each([
    [StudioVideoSort.OLDEST, { createdAt: 'ASC' }],
    [StudioVideoSort.VIEWS, { viewCount: 'DESC', createdAt: 'DESC' }],
    [StudioVideoSort.TITLE, { title: 'ASC' }],
    [StudioVideoSort.RECENT, { createdAt: 'DESC' }],
  ])('maps sort %s to order', (sort, expected) => {
    expect(buildStudioVideoFindOptions('user-1', { sort: sort as StudioVideoSort }).order).toEqual(
      expected,
    );
  });

  it('computes skip for pagination', () => {
    const opts = buildStudioVideoFindOptions('user-1', { page: 3, limit: 20 });
    expect(opts.skip).toBe(40);
    expect(opts.take).toBe(20);
    expect(opts.page).toBe(3);
    expect(opts.limit).toBe(20);
  });
});
