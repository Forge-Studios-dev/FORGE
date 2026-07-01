import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { FeedController } from './feed.controller';

describe('FeedController security', () => {
  it('exposes public feed routes', () => {
    const publicRoutes = [
      'getFeed',
      'getTrending',
      'getFollowingFeed',
      'getRecommended',
      'getPublicVideos',
      'getByCategory',
      'getBySkills',
    ] as const;

    for (const name of publicRoutes) {
      const handler = (FeedController.prototype as unknown as Record<string, unknown>)[name] as object;
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    }
  });

  it('is mounted under videos', () => {
    expect(Reflect.getMetadata('path', FeedController)).toBe('videos');
  });
});
