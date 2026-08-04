/** @jest-environment node */
import { INestApplication, ValidationPipe, RequestMethod, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { CommunityMembersController } from '../src/modules/communities/community-members.controller';
import { CommunityMembersService } from '../src/modules/communities/community-members.service';
import { CommunityStudioGuard } from '../src/modules/communities/guards/community-studio.guard';
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
import { SkillEconomyLmsGuard } from '../src/common/guards/skill-economy-lms.guard';
import { CommunityRoleGuard } from '../src/modules/communities/guards/community-role.guard';
import { GamificationController } from '../src/modules/gamification/gamification.controller';
import { GamificationService } from '../src/modules/gamification/gamification.service';
import { CommunityEngagementController } from '../src/modules/communities/community-engagement.controller';
import { CommunityEngagementService } from '../src/modules/communities/community-engagement.service';
import { CommunityRoomsController } from '../src/modules/communities/community-rooms.controller';
import { CommunityRoomsService } from '../src/modules/communities/community-rooms.service';
import { CommunityRoomMessagesService } from '../src/modules/communities/community-room-messages.service';
import { CommunityRoomPermissionsService } from '../src/modules/communities/community-room-permissions.service';
import { CommunityAiController } from '../src/modules/communities/community-ai.controller';
import { AiCommunityService } from '../src/modules/communities/ai-community.service';
import { AiBudgetService } from '../src/modules/communities/ai-budget.service';
import { CreatorAuditService } from '../src/modules/communities/creator-audit.service';
import { EntitlementsController } from '../src/modules/entitlements/entitlements.controller';
import { EntitlementsService } from '../src/modules/entitlements/entitlements.service';
import { ConfigService } from '@nestjs/config';

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
    listFeaturedCommunities: jest.fn().mockResolvedValue({
      data: [{ id: 'comm-1', name: 'Featured Community', slug: 'featured' }],
    }),
    getCommunityAnalytics: jest.fn().mockResolvedValue({
      messagesLast7Days: 10,
      activeMembersLast7Days: 5,
      postsLast7Days: 2,
      retention: { activeSubscribers: 10, engagedMembers: 7 },
    }),
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
    getCommunityAccessMeta: jest.fn().mockResolvedValue({
      communityId: 'comm-1',
      canView: false,
      canRequestJoin: true,
      joinRequestStatus: 'none',
      visibility: 'private',
    }),
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

  const engagementService = {
    listWiki: jest.fn().mockResolvedValue({ data: [{ id: 'w1', title: 'FAQ' }] }),
    listChallenges: jest.fn().mockResolvedValue({ data: [{ id: 'ch1', title: '30-day streak' }] }),
    listSurveys: jest.fn().mockResolvedValue({ data: [{ id: 's1', title: 'Feedback' }] }),
    joinChallenge: jest.fn().mockResolvedValue({ data: { id: 'p1' } }),
  };

  const roomsService = {
    listRooms: jest.fn().mockResolvedValue({ data: [{ id: 'room-1', name: 'Voice', roomType: 'voice' }] }),
    getRoom: jest.fn().mockResolvedValue({ data: { id: 'room-1', name: 'Voice', roomType: 'voice' } }),
    joinRoomToken: jest.fn().mockResolvedValue({
      data: { token: 'lk-jwt', livekitUrl: 'wss://lk', canPublish: true, roomType: 'voice' },
    }),
    raiseHand: jest.fn().mockResolvedValue({ data: { raised: true } }),
  };

  const roomMessagesService = {
    listMessages: jest.fn().mockResolvedValue({ data: [{ id: 'rm-1', body: 'Hello room' }], meta: {} }),
    sendMessage: jest.fn().mockResolvedValue({ data: { id: 'rm-2', body: 'Hi' } }),
    deleteMessage: jest.fn().mockResolvedValue({ ok: true }),
  };

  const roomPermissionsService = {
    listPermissions: jest.fn().mockResolvedValue({ data: [] }),
    grantPermission: jest.fn().mockResolvedValue({ ok: true }),
    revokePermission: jest.fn().mockResolvedValue({ ok: true }),
  };

  const aiCommunityService = {
    scoreContentAsync: jest.fn().mockResolvedValue({
      score: 0.1,
      flagged: false,
      reasons: [],
      model: 'regex',
    }),
    summarizeDiscussionAsync: jest.fn().mockResolvedValue('Recent themes: hello.'),
    communityHealthScore: jest.fn().mockReturnValue({ score: 72, tips: [] }),
  };

  const auditService = {
    listForCreator: jest.fn().mockResolvedValue({ data: [{ id: 'log-1', action: 'room.permission.grant' }] }),
  };

  const membersService = {
    requestJoin: jest.fn().mockResolvedValue({ data: { id: 'm1', status: 'pending' }, pending: true }),
    listMembers: jest.fn().mockResolvedValue({ data: [{ id: 'm1', userId: 'user-2', status: 'pending' }] }),
    approveMember: jest.fn().mockResolvedValue({ data: { id: 'm1', status: 'active' } }),
    rejectMember: jest.fn().mockResolvedValue({ data: { id: 'm1', status: 'rejected' } }),
  };

  const entitlementsService = {
    creatorGrantSubscription: jest.fn().mockResolvedValue({
      id: 'sub-grant-1',
      userId: '00000000-0000-4000-8000-000000000002',
      status: 'active',
      source: 'creator_grant',
    }),
    cancelMySubscription: jest.fn().mockResolvedValue({ canceled: false, cancelAtPeriodEnd: true }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        CommunityMembersController,
        CommunityPostsController,
        CommunitiesController,
        CommunityPollsController,
        CommunityModerationController,
        GamificationController,
        CommunityEngagementController,
        CommunityRoomsController,
        CommunityAiController,
        EntitlementsController,
      ],
      providers: [
        { provide: CommunityPostsService, useValue: postsService },
        { provide: CommunitiesService, useValue: communitiesService },
        { provide: CommunityPollsService, useValue: pollsService },
        { provide: CommunityModerationService, useValue: moderationService },
        { provide: GamificationService, useValue: gamificationService },
        { provide: CommunityEngagementService, useValue: engagementService },
        { provide: CommunityRoomsService, useValue: roomsService },
        { provide: CommunityRoomMessagesService, useValue: roomMessagesService },
        { provide: CommunityRoomPermissionsService, useValue: roomPermissionsService },
        { provide: AiCommunityService, useValue: aiCommunityService },
        { provide: AiBudgetService, useValue: { checkAndCharge: jest.fn().mockResolvedValue({ allowed: true, remaining: 100 }) } },
        { provide: CreatorAuditService, useValue: auditService },
        { provide: CommunityMembersService, useValue: membersService },
        { provide: EntitlementsService, useValue: entitlementsService },
        SkillEconomyLmsGuard,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'features.skillEconomyLms' ? false : undefined),
          },
        },
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
      .overrideGuard(CommunityStudioGuard)
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

  it('GET /api/v1/communities/discover/featured returns featured communities', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/communities/discover/featured');
    expect(res.status).toBe(200);
    expect(communitiesService.listFeaturedCommunities).toHaveBeenCalled();
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

  it('POST /api/v1/communities/:id/gamification/check-in returns 410 when LMS soft-retired', async () => {
    const res = await request(app.getHttpServer()).post(
      '/api/v1/communities/comm-1/gamification/check-in',
    );
    expect(res.status).toBe(410);
    expect(gamificationService.checkIn).not.toHaveBeenCalled();
  });

  it('GET /api/v1/communities/:id/leaderboard returns 410 when LMS soft-retired', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/communities/comm-1/leaderboard');
    expect(res.status).toBe(410);
    expect(gamificationService.leaderboard).not.toHaveBeenCalled();
  });

  it('GET /api/v1/creators/me/business-analytics returns creator funnel', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/creators/me/business-analytics');
    expect(res.status).toBe(200);
    expect(communitiesService.getCreatorBusinessAnalytics).toHaveBeenCalledWith('user-1');
  });

  it('GET /api/v1/communities/:id/wiki returns 410 when LMS soft-retired', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/communities/comm-1/wiki');
    expect(res.status).toBe(410);
    expect(engagementService.listWiki).not.toHaveBeenCalled();
  });

  it('GET /api/v1/communities/:id/challenges returns 410 when LMS soft-retired', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/communities/comm-1/challenges');
    expect(res.status).toBe(410);
    expect(engagementService.listChallenges).not.toHaveBeenCalled();
  });

  it('POST /api/v1/communities/:id/challenges/:challengeId/join returns 410 when LMS soft-retired', async () => {
    const res = await request(app.getHttpServer()).post(
      '/api/v1/communities/comm-1/challenges/ch-1/join',
    );
    expect(res.status).toBe(410);
    expect(engagementService.joinChallenge).not.toHaveBeenCalled();
  });

  it('GET /api/v1/communities/:id/rooms lists rooms', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/communities/comm-1/rooms');
    expect(res.status).toBe(200);
    expect(roomsService.listRooms).toHaveBeenCalledWith('comm-1', 'user-1', 'consumer');
  });

  it('POST /api/v1/communities/:id/rooms/:roomId/token returns LiveKit token', async () => {
    const res = await request(app.getHttpServer()).post(
      '/api/v1/communities/comm-1/rooms/room-1/token',
    );
    expect(res.status).toBe(201);
    expect(roomsService.joinRoomToken).toHaveBeenCalled();
  });

  it('POST /api/v1/communities/:id/rooms/:roomId/raise-hand raises hand in stage', async () => {
    const res = await request(app.getHttpServer()).post(
      '/api/v1/communities/comm-1/rooms/room-1/raise-hand',
    );
    expect(res.status).toBe(201);
    expect(roomsService.raiseHand).toHaveBeenCalled();
  });

  it('GET /api/v1/communities/:id/rooms/:roomId/messages lists text room messages', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/communities/comm-1/rooms/room-1/messages',
    );
    expect(res.status).toBe(200);
    expect(roomMessagesService.listMessages).toHaveBeenCalled();
  });

  it('POST /api/v1/communities/:id/rooms/:roomId/messages sends text room message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/communities/comm-1/rooms/room-1/messages')
      .send({ body: 'Hello text room' });
    expect(res.status).toBe(201);
    expect(roomMessagesService.sendMessage).toHaveBeenCalled();
  });

  it('POST /api/v1/creators/me/ai/moderation/score scores content', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/creators/me/ai/moderation/score')
      .send({ text: 'Hello community' });
    expect(res.status).toBe(201);
    expect(aiCommunityService.scoreContentAsync).toHaveBeenCalled();
  });

  it('GET /api/v1/creators/me/audit-logs returns creator audit history', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/creators/me/audit-logs');
    expect(res.status).toBe(200);
    expect(auditService.listForCreator).toHaveBeenCalled();
  });

  it('GET /api/v1/creators/me/communities/:id/rooms/:roomId/summary summarizes room', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/creators/me/communities/comm-1/rooms/room-1/summary',
    );
    expect(res.status).toBe(200);
    expect(roomMessagesService.listMessages).toHaveBeenCalled();
    expect(aiCommunityService.summarizeDiscussionAsync).toHaveBeenCalled();
  });

  it('POST /api/v1/communities/:id/join-request submits join request', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/communities/comm-1/join-request');
    expect(res.status).toBe(201);
    expect(membersService.requestJoin).toHaveBeenCalledWith('user-1', 'comm-1', 'consumer');
  });

  it('GET /api/v1/creators/me/communities/:id/members lists members', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/creators/me/communities/comm-1/members?status=pending',
    );
    expect(res.status).toBe(200);
    expect(membersService.listMembers).toHaveBeenCalledWith('user-1', 'comm-1', 'pending');
  });

  it('PATCH /api/v1/creators/me/communities/:id/members/:userId/approve approves member', async () => {
    const res = await request(app.getHttpServer()).patch(
      '/api/v1/creators/me/communities/comm-1/members/user-2/approve',
    );
    expect(res.status).toBe(200);
    expect(membersService.approveMember).toHaveBeenCalledWith('user-1', 'comm-1', 'user-2', 'consumer');
  });

  it('GET /api/v1/creators/:creatorId/communities/:slug/access returns join metadata', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/creators/creator-1/communities/test/access',
    );
    expect(res.status).toBe(200);
    expect(communitiesService.getCommunityAccessMeta).toHaveBeenCalledWith(
      'creator-1',
      'test',
      'user-1',
      'consumer',
    );
  });

  it('PATCH /api/v1/creators/me/communities/:id/members/:userId/reject rejects member', async () => {
    const res = await request(app.getHttpServer()).patch(
      '/api/v1/creators/me/communities/comm-1/members/user-2/reject',
    );
    expect(res.status).toBe(200);
    expect(membersService.rejectMember).toHaveBeenCalledWith('user-1', 'comm-1', 'user-2', 'consumer');
  });

  it('POST /api/v1/creators/me/subscribers/grant grants comp membership', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/creators/me/subscribers/grant')
      .send({
        userId: '00000000-0000-4000-8000-000000000002',
        tierId: '00000000-0000-4000-8000-000000000003',
        expiresInDays: 30,
      });
    expect(res.status).toBe(201);
    expect(entitlementsService.creatorGrantSubscription).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        userId: '00000000-0000-4000-8000-000000000002',
        tierId: '00000000-0000-4000-8000-000000000003',
        expiresInDays: 30,
      }),
    );
  });

  it('DELETE /api/v1/subscriptions/me/:creatorId?cancelAtPeriodEnd=true schedules cancel', async () => {
    const res = await request(app.getHttpServer()).delete(
      '/api/v1/subscriptions/me/creator-1?cancelAtPeriodEnd=true',
    );
    expect(res.status).toBe(200);
    expect(entitlementsService.cancelMySubscription).toHaveBeenCalledWith(
      'user-1',
      'creator-1',
      true,
    );
  });
});
