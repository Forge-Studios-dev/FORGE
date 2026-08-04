/**
 * Admin moderation actions were only tested via decorator metadata
 * (admin.security.spec.ts checks @Roles(ADMIN) is present on the class) —
 * never proven to actually reject a non-admin request or actually perform
 * the moderation action for an admin. This exercises the real guard chain
 * (JwtAuthGuard -> RolesGuard, matching APP_GUARD registration in
 * app.module.ts) against PATCH /admin/reports/:id, real
 * AdminController -> ReportsService chain; only TypeORM repositories are
 * mocked (per forge-testing.md, no live DB/Redis).
 */
import { ClassSerializerInterceptor, INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AdminController } from '../src/modules/admin/admin.controller';
import { AdminService } from '../src/modules/admin/admin.service';
import { ReportsService } from '../src/modules/reports/reports.service';
import { ReportStatus } from '../src/modules/reports/entities/report.entity';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { CategoriesService } from '../src/modules/categories/categories.service';
import { EntitlementsService } from '../src/modules/entitlements/entitlements.service';
import { AuthUserCacheService } from '../src/modules/auth/auth-user-cache.service';
import { AuthSessionCacheService } from '../src/modules/auth/auth-session-cache.service';
import { DatabaseObservabilityService } from '../src/database/database-observability.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { User, UserRole } from '../src/modules/users/entities/user.entity';
import { Video } from '../src/modules/content/entities/video.entity';
import { Report } from '../src/modules/reports/entities/report.entity';
import { Comment } from '../src/modules/engagement/entities/comment.entity';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

const JWT_SECRET = 'test-secret-for-admin-moderation-e2e';
const REPORT_ID = '11111111-1111-4111-8111-111111111111';

describe('Admin moderation HTTP guard + action (HIGH-07)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const reportRepository = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const userRepository = {
    findOne: jest.fn(),
  };

  function signToken(role: UserRole): string {
    return jwtService.sign({ sub: 'user-1', email: 'a@b.com', role, isVerified: true });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [AdminController],
      providers: [
        JwtService,
        { provide: 'JWT_MODULE_OPTIONS', useValue: {} },
        JwtStrategy,
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'jwt.secret' ? JWT_SECRET : '') } },
        { provide: ClsService, useValue: { set: jest.fn(), get: jest.fn() } },
        {
          provide: AuthUserCacheService,
          useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn(), bust: jest.fn() },
        },
        {
          provide: AuthSessionCacheService,
          useValue: { assertSessionActive: jest.fn().mockResolvedValue(true) },
        },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Video), useValue: {} },
        { provide: getRepositoryToken(Report), useValue: reportRepository },
        { provide: getRepositoryToken(Comment), useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        ReportsService,
        { provide: AnalyticsService, useValue: {} },
        { provide: CategoriesService, useValue: {} },
        { provide: AdminService, useValue: {} },
        { provide: EntitlementsService, useValue: {} },
        { provide: DatabaseObservabilityService, useValue: {} },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
      new TransformInterceptor(),
    );
    await app.init();

    jwtService = new JwtService({ secret: JWT_SECRET });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('401s with no JWT at all', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/reports/${REPORT_ID}`)
      .send({ status: ReportStatus.REVIEWED })
      .expect(401);
    expect(reportRepository.update).not.toHaveBeenCalled();
  });

  it('403s a non-admin JWT (RolesGuard rejection)', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      role: UserRole.USER,
      isVerified: true,
      isActive: true,
      deletedAt: null,
    });
    const token = signToken(UserRole.USER);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/reports/${REPORT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: ReportStatus.REVIEWED })
      .expect(403);
    expect(reportRepository.update).not.toHaveBeenCalled();
  });

  it('200s and performs the moderation action for an admin JWT', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      role: UserRole.ADMIN,
      isVerified: true,
      isActive: true,
      deletedAt: null,
    });
    const token = signToken(UserRole.ADMIN);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/reports/${REPORT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: ReportStatus.REVIEWED })
      .expect(200);

    expect(res.body.data).toEqual({ ok: true });
    expect(reportRepository.update).toHaveBeenCalledWith(
      REPORT_ID,
      expect.objectContaining({ status: ReportStatus.REVIEWED }),
    );
  });
});
