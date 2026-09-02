/** @jest-environment node */
import { INestApplication, ValidationPipe, RequestMethod, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { CreatorBundlesController } from '../src/modules/entitlements/creator-bundles.controller';
import { CreatorBundlesService } from '../src/modules/entitlements/creator-bundles.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { CreatorApprovedGuard } from '../src/common/guards/creator-approved.guard';
import { SkillEconomyLmsGuard } from '../src/common/guards/skill-economy-lms.guard';

describe('Creator bundles HTTP (mocked e2e)', () => {
  let app: INestApplication;

  const bundlesService = {
    listForCreator: jest.fn().mockResolvedValue({ data: [{ id: 'b1', name: 'Pro bundle' }] }),
    listPublic: jest.fn().mockResolvedValue({ data: [] }),
    create: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CreatorBundlesController],
      providers: [{ provide: CreatorBundlesService, useValue: bundlesService }],
    })
      .overrideGuard(SkillEconomyLmsGuard)
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

  it('GET /api/v1/creators/me/bundles lists creator bundles', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/creators/me/bundles');
    expect(res.status).toBe(200);
    expect(bundlesService.listForCreator).toHaveBeenCalledWith('user-1');
    expect(bundlesService.listPublic).not.toHaveBeenCalled();
  });
});
