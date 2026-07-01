/** @jest-environment node */
import { INestApplication, ValidationPipe, RequestMethod, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { CoursesController } from '../src/modules/courses/courses.controller';
import { CoursesService } from '../src/modules/courses/courses.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { CreatorApprovedGuard } from '../src/common/guards/creator-approved.guard';

describe('Courses HTTP (mocked e2e)', () => {
  let app: INestApplication;

  const course = {
    id: 'course-1',
    creatorId: 'user-1',
    title: 'Intro',
    slug: 'intro',
    description: null,
    isPublished: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const coursesService = {
    listPublishedForCreator: jest.fn().mockResolvedValue([course]),
    listForCreator: jest.fn().mockResolvedValue([course]),
    createCourse: jest.fn().mockResolvedValue(course),
    updateCourse: jest.fn().mockResolvedValue({ ...course, isPublished: true }),
    createLesson: jest.fn().mockResolvedValue({ id: 'lesson-1', title: 'L1' }),
    listLessons: jest.fn().mockResolvedValue([{ id: 'lesson-1', title: 'L1', sortOrder: 0 }]),
    enroll: jest.fn(),
    getProgress: jest.fn(),
    updateLessonProgress: jest.fn(),
    createCohort: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [{ provide: CoursesService, useValue: coursesService }],
    })
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

  it('GET /api/v1/creators/me/courses lists creator courses', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/creators/me/courses');
    expect(res.status).toBe(200);
    expect(coursesService.listForCreator).toHaveBeenCalledWith('user-1');
  });

  it('PATCH /api/v1/creators/me/courses/:id publishes course', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/creators/me/courses/course-1')
      .send({ isPublished: true });
    expect(res.status).toBe(200);
    expect(coursesService.updateCourse).toHaveBeenCalledWith('user-1', 'course-1', {
      isPublished: true,
    });
    expect(res.body.data?.isPublished).toBe(true);
  });

  it('POST /api/v1/creators/me/courses/:id/lessons creates lesson', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/creators/me/courses/course-1/lessons')
      .send({ title: 'Lesson 1', content: 'Hello' });
    expect(res.status).toBe(201);
    expect(coursesService.createLesson).toHaveBeenCalled();
  });

  it('GET /api/v1/courses/:id/lessons lists lessons', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/courses/course-1/lessons');
    expect(res.status).toBe(200);
    expect(coursesService.listLessons).toHaveBeenCalledWith('course-1', 'user-1');
  });
});
