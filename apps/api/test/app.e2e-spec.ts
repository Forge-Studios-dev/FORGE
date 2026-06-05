/** @jest-environment node */
import { INestApplication, ValidationPipe, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('API HTTP (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      console.warn('Skipping e2e: DATABASE_URL not set');
      return;
    }

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: 'metrics', method: RequestMethod.ALL }],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
    app.enableShutdownHooks();
    await app.init();
  }, 180_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 30_000);

  it('GET /api/v1/health/live returns ok', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body.data?.status ?? res.body.status).toMatch(/ok|live/i);
  });

  it('GET /api/v1/health/ready checks dependencies', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready');
    expect([200, 503]).toContain(res.status);
  });

  it('POST /api/v1/auth/signup validates input', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email: 'not-an-email', password: 'short', username: 'x', displayName: 'X' });
    expect(res.status).toBe(400);
  });
});
