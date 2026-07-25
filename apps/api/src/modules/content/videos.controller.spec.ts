import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { VideosController } from './videos.controller';

describe('VideosController security', () => {
  it('exposes public feed routes moved from FeedController (route-shadow fix)', () => {
    const publicRoutes = ['getFeed', 'getPublicVideos', 'getBySkills'] as const;

    for (const name of publicRoutes) {
      const handler = (VideosController.prototype as unknown as Record<string, unknown>)[name] as object;
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    }
  });

  it('is mounted under videos', () => {
    expect(Reflect.getMetadata('path', VideosController)).toBe('videos');
  });
});
