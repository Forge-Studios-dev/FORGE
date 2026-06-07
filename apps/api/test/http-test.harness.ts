/**
 * Lightweight HTTP test harness — no database, Redis, or external services.
 * Use for Supertest "e2e" tests that exercise routing, pipes, and controllers only.
 */
import {
  INestApplication,
  ValidationPipe,
  RequestMethod,
  ClassSerializerInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { getQueueToken } from '@nestjs/bullmq';
import { HealthController } from '../src/health.controller';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthOAuthExchangeService } from '../src/modules/auth/auth-oauth-exchange.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { AppCheckGuard } from '../src/modules/firebase/app-check.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { VIDEO_PROCESSING_QUEUE } from '../src/modules/content/videos.service';
import { MUX_VOD_INGEST_QUEUE } from '../src/modules/content/mux-vod.constants';

const mockQueue = {
  getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, delayed: 0, failed: 0 }),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const map: Record<string, unknown> = {
      'video.transcodeProvider': 'mux',
      'firebase.appCheckEnabled': false,
      nodeEnv: 'test',
      'jwt.secret': 'test-jwt-secret-min-32-characters-long',
      'auth.refreshCookieDomain': '',
    };
    return map[key];
  }),
};

export async function createMockHttpApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [HealthController, AuthController],
    providers: [
      { provide: AuthService, useValue: { signup: jest.fn(), login: jest.fn() } },
      {
        provide: AuthOAuthExchangeService,
        useValue: {
          createExchangeCode: jest.fn(),
          consumeExchangeCode: jest
            .fn()
            .mockRejectedValue(new UnauthorizedException('Invalid or expired OAuth exchange code')),
        },
      },
      { provide: NotificationsService, useValue: {} },
      { provide: ConfigService, useValue: mockConfigService },
      { provide: DataSource, useValue: { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } },
      { provide: getRedisConnectionToken(), useValue: { ping: jest.fn().mockResolvedValue('PONG') } },
      { provide: getQueueToken(VIDEO_PROCESSING_QUEUE), useValue: mockQueue },
      { provide: getQueueToken(MUX_VOD_INGEST_QUEUE), useValue: mockQueue },
    ],
  })
    .overrideGuard(AppCheckGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleFixture.createNestApplication({ rawBody: true });
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
  return app;
}
