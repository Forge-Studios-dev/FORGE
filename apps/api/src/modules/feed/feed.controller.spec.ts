import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { FeedController } from './feed.controller';

describe('FeedController security', () => {
  it('exposes public feed routes', () => {
    // `getFeed`/`getPublicVideos`/`getBySkills` moved to VideosController —
    // see videos.controller.ts and route-shadow-order.spec.ts. Covered by
    // the equivalent check in videos.controller.spec.ts.
    const publicRoutes = ['getTrending', 'getFollowingFeed', 'getRecommended', 'getByCategory'] as const;

    for (const name of publicRoutes) {
      const handler = (FeedController.prototype as unknown as Record<string, unknown>)[name] as object;
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    }
  });

  it('is mounted under videos', () => {
    expect(Reflect.getMetadata('path', FeedController)).toBe('videos');
  });
});
