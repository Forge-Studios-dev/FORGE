/** @jest-environment node */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createMockHttpApp } from './http-test.harness';

describe('API HTTP (mocked e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createMockHttpApp();
  }, 30_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /api/v1/health/live returns ok without external services', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body.data?.status ?? res.body.status).toMatch(/ok|live/i);
  });

  it('GET /api/v1/health/ready uses mocked dependencies', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.data?.checks?.database).toBe('ok');
    expect(res.body.data?.checks?.redis).toBe('ok');
  });

  it('POST /api/v1/auth/signup validates input before hitting AuthService', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email: 'not-an-email', password: 'short', username: 'x', displayName: 'X' });
    expect(res.status).toBe(400);
  });
});
