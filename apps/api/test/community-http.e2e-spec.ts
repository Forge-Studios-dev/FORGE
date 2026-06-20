/** @jest-environment node */
import { INestApplication, ValidationPipe, RequestMethod, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { CommunityPostsController } from '../src/modules/communities/community-posts.controller';
import { CommunityPostsService } from '../src/modules/communities/community-posts.service';
import { CommunitiesController } from '../src/modules/communities/communities.controller';
import { CommunitiesService } from '../src/modules/communities/communities.service';
import { CommunityPollsController } from '../src/modules/communities/community-polls.controller';
import { CommunityPollsService } from '../src/modules/communities/community-polls.service';
import { CommunityModerationController } from '../src/modules/communities/community-moderation.controller';
import { CommunityModerationService } from '../src/modules/communities/community-moderation.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../src/common/guards/optional-jwt.guard';
import { CreatorApprovedGuard } from '../src/common/guards/creator-approved.guard';
import { CommunityRoleGuard } from '../src/modules/communities/guards/community-role.guard';
import { GamificationController } from '../src/modules/gamification/gamification.controller';
import { GamificationService } from '../src/modules/gamification/gamification.service';

describe('Community HTTP (mocked e2e)', () => {
  let app: INestApplication;

  const postsService = {
    listPosts: jest.fn().mockResolvedValue({ data: [{ id: 'post-1', body: 'Hello' }], meta: {} }),
    searchPosts: jest.fn().mockResolvedValue({ data: [] }),
    listComments: jest.fn().mockResolvedValue({ data: [{ id: 'c1', body: 'Nice' }] }),
    createComment: jest.fn().mockResolvedValue({ id: 'c2', createdAt: new Date().toISOString() }),
    toggleReaction: jest.fn().mockResolvedValue({ liked: true }),
  };

  const communitiesService = {
    searchCommunities: jest.fn().mockResolvedValue({
      data: [{ id: 'comm-1', name: 'Test Community', slug: 'test' }],
    }),
    getCommunityAnalytics: jest.fn().mockResolvedValue({ messages7d: 10, posts7d: 2 }),
    listModeratedCommunities: jest.fn().mockResolvedValue({
      data: [{ communityId: 'comm-1', role: 'moderator' }],
    }),
    getCommunityLiveStreams: jest.fn().mockResolvedValue([{ id: 'stream-1', title: 'Live' }]),
    getCreatorBusinessAnalytics: jest.fn().mockResolvedValue({
      periodDays: 30,
      funnel: [{ stage: 'paying_members', label: 'Paying', count: 10, rateFromTop: 100 }],
      cohortRetention: { weekly: [], monthly: [] },
      communities: [],
    }),
    assertCommunityAccess: jest.fn().mockResolvedValue(undefined),
  };

  const pollsService = {
    getActivePoll: jest.fn().mockResolvedValue({ id: 'poll-1', question: 'Q?' }),
  };

  const gamificationService = {
    leaderboard: jest.fn().mockResolvedValue([{ rank: 1, userId: 'u1', xp: 100, level: 2 }]),
    checkIn: jest.fn().mockResolvedValue({ xp: 110, level: 2, streak: 1, alreadyCheckedIn: false }),
    getProfile: jest.fn().mockResolvedValue({ xp: 100, level: 2, streak: 0, badges: [] }),
  };

  const moderationService = {
    createReport: jest.fn().mockResolvedValue({ id: 'report-1' }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        CommunityPostsController,
        CommunitiesController,
        CommunityPollsController,
        CommunityModerationController,
        GamificationController,
      ],
      providers: [
        { provide: CommunityPostsService, useValue: postsService },
        { provide: CommunitiesService, useValue: communitiesService },
        { provide: CommunityPollsService, useValue: pollsService },
        { provide: CommunityModerationService, useValue: moderationService },
        { provide: GamificationService, useValue: gamificationService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { sub: 'user-1', role: 'consumer' };
          return true;
        },
      })
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CreatorApprovedGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CommunityRoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = { sub: 'user-1', role: 'consumer' };
      next();
    });
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: 'metrics', method: RequestMethod.ALL }],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
      new TransformInterceptor(),
    );
    await app.init();
  }, 30_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /api/v1/communities/search returns discovery results', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/communities/search?q=test');
    expect(res.status).toBe(200);
    expect(communitiesService.searchCommunities).toHaveBeenCalled();
    expect(res.body.data?.data?.[0]?.slug).toBe('test');
  });

  it('GET /api/v1/communities/:id/posts lists posts', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/communities/comm-1/posts');
    expect(res.status).toBe(200);
    expect(postsService.listPosts).toHaveBeenCalledWith(
      'comm-1',
      30,
      undefined,
      'user-1',
      'consumer',
    );
  });

  it('GET /api/v1/communities/:id/posts/:postId/comments lists comments', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/communities/comm-1/posts/post-1/comments',
    );
    expect(res.status).toBe(200);
    expect(postsService.listComments).toHaveBeenCalled();
  });

  it('POST /api/v1/communities/:id/posts/:postId/comments creates comment', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/communities/comm-1/posts/post-1/comments')
      .send({ body: 'Great post' });
    expect(res.status).toBe(201);
    expect(postsService.createComment).toHaveBeenCalled();
  });

  it('POST /api/v1/communities/:id/posts/:postId/reactions toggles like', async () => {
    const res = await request(app.getHttpServer()).post(
      '/api/v1/communities/comm-1/posts/post-1/reactions',
    );
    expect(res.status).toBe(201);
    expect(postsService.toggleReaction).toHaveBeenCalled();
  });

  it('GET /api/v1/creators/me/moderated-communities lists delegated roles', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/creators/me/moderated-communities');
    expect(res.status).toBe(200);
    expect(communitiesService.listModeratedCommunities).toHaveBeenCalledWith('user-1');
  });

  it('GET /api/v1/creators/me/communities/:id/analytics returns metrics', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/creators/me/communities/comm-1/analytics',
    );
    expect(res.status).toBe(200);
    expect(communitiesService.getCommunityAnalytics).toHaveBeenCalledWith('user-1', 'comm-1');
  });

  it('GET /api/v1/communities/:id/live returns community streams', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/communities/comm-1/live');
    expect(res.status).toBe(200);
    expect(communitiesService.getCommunityLiveStreams).toHaveBeenCalled();
  });

  it('GET /api/v1/communities/:id/polls/active returns poll', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/communities/comm-1/polls/active');
    expect(res.status).toBe(200);
    expect(pollsService.getActivePoll).toHaveBeenCalledWith('comm-1', 'user-1', 'consumer');
  });

  it('POST /api/v1/communities/:id/gamification/check-in awards streak XP', async () => {
    const res = await request(app.getHttpServer()).post(
      '/api/v1/communities/comm-1/gamification/check-in',
    );
    expect(res.status).toBe(201);
    expect(gamificationService.checkIn).toHaveBeenCalledWith('user-1', 'comm-1');
  });

  it('GET /api/v1/communities/:id/leaderboard returns ranks', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/communities/comm-1/leaderboard');
    expect(res.status).toBe(200);
    expect(gamificationService.leaderboard).toHaveBeenCalledWith('comm-1');
  });

  it('GET /api/v1/creators/me/business-analytics returns creator funnel', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/creators/me/business-analytics');
    expect(res.status).toBe(200);
    expect(communitiesService.getCreatorBusinessAnalytics).toHaveBeenCalledWith('user-1');
  });
});
