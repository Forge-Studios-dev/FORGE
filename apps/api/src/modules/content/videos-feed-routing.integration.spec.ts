import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { RecommendationsService } from './recommendations.service';
import { ContentLibraryService } from './content-library.service';
import { FeedController } from '../feed/feed.controller';
import { FeedService } from '../feed/feed.service';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { UploadNotRestrictedGuard } from '../../common/guards/upload-not-restricted.guard';

/**
 * Real HTTP-level regression test for the route-shadow incident (PR #151 →
 * #152 → this fix): registers the actual VideosController and FeedController
 * classes — unmocked, real decorators, real Express route registration —
 * with only their service dependencies mocked. Two prior fix attempts looked
 * correct under static analysis (a regression test that re-derived source
 * text) and both broke in production anyway, because the real behavior
 * depends on NestJS's actual RouterExplorer/Express matching, not on
 * reasoning about it. This exercises that real matching directly.
 */
describe('videos/feed HTTP routing (route-shadow regression, real router)', () => {
  let app: INestApplication;

  const videosService = { getVideoForViewer: jest.fn().mockResolvedValue({ id: 'video-1' }) };
  const feedService = {
    getFeed: jest.fn().mockResolvedValue({ data: [], meta: { cursor: null, hasMore: false } }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      // FeedController listed first here deliberately: it's the worse-case
      // ordering for VideosController's within-class fix to prove itself
      // against, since cross-controller order can't be relied on either way.
      controllers: [FeedController, VideosController],
      providers: [
        { provide: VideosService, useValue: videosService },
        { provide: RecommendationsService, useValue: { getTrending: jest.fn(), getPersonalizedFeed: jest.fn() } },
        { provide: ContentLibraryService, useValue: {} },
        { provide: FeedService, useValue: feedService },
      ],
    })
      .overrideGuard(CreatorApprovedGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(UploadNotRestrictedGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  it('GET /videos/feed resolves to FeedService.getFeed, not VideosController.findOne', async () => {
    await request(app.getHttpServer()).get('/videos/feed').expect(200);
    expect(feedService.getFeed).toHaveBeenCalledTimes(1);
    expect(videosService.getVideoForViewer).not.toHaveBeenCalled();
  });

  it('GET /videos/public resolves to FeedService.getFeed', async () => {
    await request(app.getHttpServer()).get('/videos/public').expect(200);
    expect(feedService.getFeed).toHaveBeenCalledTimes(1);
    expect(videosService.getVideoForViewer).not.toHaveBeenCalled();
  });

  it('GET /videos/by-skills resolves to FeedService.getFeed', async () => {
    await request(app.getHttpServer()).get('/videos/by-skills').expect(200);
    expect(feedService.getFeed).toHaveBeenCalledTimes(1);
    expect(videosService.getVideoForViewer).not.toHaveBeenCalled();
  });

  it('GET /videos/:id (real id) still resolves to VideosController.findOne', async () => {
    await request(app.getHttpServer()).get('/videos/550e8400-e29b-41d4-a716-446655440000').expect(200);
    expect(videosService.getVideoForViewer).toHaveBeenCalledTimes(1);
    expect(feedService.getFeed).not.toHaveBeenCalled();
  });
});
