/** @jest-environment node */
import { INestApplication, ValidationPipe, RequestMethod, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { CreatorProgramsController } from '../src/modules/courses/creator-programs.controller';
import { CreatorProgramsService } from '../src/modules/courses/creator-programs.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { CreatorApprovedGuard } from '../src/common/guards/creator-approved.guard';
import { SkillFeatureGuard } from '../src/common/guards/skill-feature.guard';
import { OptionalJwtAuthGuard } from '../src/common/guards/optional-jwt.guard';

describe('Programs HTTP (mocked e2e)', () => {
  let app: INestApplication;

  const program = {
    id: 'prog-1',
    name: 'Full Stack',
    slug: 'full-stack',
    description: 'Learn end to end',
    isFree: false,
    priceCents: 2500,
    hasPurchased: false,
    courses: [{ id: 'pc-1', courseId: 'course-1', course: { id: 'course-1', title: 'Intro', slug: 'intro', isPublished: true } }],
  };

  const programsService = {
    listPublishedForCreator: jest.fn().mockResolvedValue([program]),
    getPublishedBySlug: jest.fn().mockResolvedValue(program),
    enrollInProgram: jest.fn().mockResolvedValue({
      programId: 'prog-1',
      enrollments: [{ courseId: 'course-1', enrollmentId: 'en-1' }],
    }),
    createProgramCheckout: jest.fn().mockResolvedValue({
      ok: true,
      requiresCheckout: true,
      checkoutUrl: 'https://checkout.stripe.com/test',
      sessionId: 'cs_test',
    }),
    listForCreator: jest.fn().mockResolvedValue([program]),
    createProgram: jest.fn(),
    updateProgram: jest.fn(),
    deleteProgram: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CreatorProgramsController],
      providers: [
        { provide: CreatorProgramsService, useValue: programsService },
        SkillFeatureGuard,
      ],
    })
      .overrideGuard(SkillFeatureGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { sub: 'user-1', role: 'creator' };
          return true;
        },
      })
      .overrideGuard(CreatorApprovedGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = { sub: 'user-1', role: 'creator' };
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/v1/creators/:id/programs lists published programs', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/creators/creator-1/programs');
    expect(res.status).toBe(200);
    expect(programsService.listPublishedForCreator).toHaveBeenCalledWith('creator-1', 'user-1');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]?.slug).toBe('full-stack');
  });

  it('GET /api/v1/creators/:id/programs/:slug returns program detail', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/creators/creator-1/programs/full-stack');
    expect(res.status).toBe(200);
    expect(programsService.getPublishedBySlug).toHaveBeenCalledWith('creator-1', 'full-stack', 'user-1');
    expect(res.body.data?.name).toBe('Full Stack');
  });

  it('POST /api/v1/programs/:id/enroll enrolls user', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/programs/prog-1/enroll').send({});
    expect([200, 201]).toContain(res.status);
    expect(programsService.enrollInProgram).toHaveBeenCalledWith('user-1', 'prog-1');
  });

  it('POST /api/v1/programs/:id/checkout creates Stripe session', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/programs/prog-1/checkout')
      .send({
        successUrl: 'https://forgestudios.net/success',
        cancelUrl: 'https://forgestudios.net/cancel',
      });
    expect(res.status).toBe(201);
    expect(programsService.createProgramCheckout).toHaveBeenCalledWith('user-1', 'prog-1', {
      successUrl: 'https://forgestudios.net/success',
      cancelUrl: 'https://forgestudios.net/cancel',
    });
    expect(res.body.data?.checkoutUrl).toContain('checkout.stripe.com');
  });

  it('GET /api/v1/creators/me/programs lists creator programs', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/creators/me/programs');
    expect(res.status).toBe(200);
    expect(programsService.listForCreator).toHaveBeenCalledWith('user-1');
  });

  it('GET /api/v1/creators/me/programs does not hit public list with creatorId=me', async () => {
    await request(app.getHttpServer()).get('/api/v1/creators/me/programs');
    expect(programsService.listPublishedForCreator).not.toHaveBeenCalled();
  });
});
