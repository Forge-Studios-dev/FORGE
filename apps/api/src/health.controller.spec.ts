import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok when database and redis succeed', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } },
        { provide: getRedisConnectionToken(), useValue: { ping: jest.fn().mockResolvedValue('PONG') } },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);
    const req = { correlationId: 'test-corr' } as Parameters<typeof controller.getHealth>[0];
    const res = await controller.getHealth(req);

    expect(res.status).toBe('ok');
    expect(res.checks.database).toBe('ok');
    expect(res.checks.redis).toBe('ok');
    expect(res.correlationId).toBe('test-corr');
  });

  it('returns degraded when database fails', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: { query: jest.fn().mockRejectedValue(new Error('db down')) } },
        { provide: getRedisConnectionToken(), useValue: { ping: jest.fn().mockResolvedValue('PONG') } },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);
    const res = await controller.getHealth({} as Parameters<typeof controller.getHealth>[0]);

    expect(res.status).toBe('degraded');
    expect(res.checks.database).toBe('down');
    expect(res.checks.redis).toBe('ok');
  });
});
