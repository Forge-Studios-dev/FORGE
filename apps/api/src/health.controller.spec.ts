import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { getQueueToken } from '@nestjs/bullmq';
import { HealthController } from './health.controller';
import { VIDEO_PROCESSING_QUEUE } from './modules/content/video-processing.constants';
import { MUX_VOD_INGEST_QUEUE } from './modules/content/mux-vod.constants';

const mockVideoQueue = {
  getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, delayed: 0, failed: 0 }),
};

const mockConfig = {
  get: (key: string) => (key === 'video.transcodeProvider' ? 'mux' : undefined),
};

describe('HealthController', () => {
  it('returns ok when database and redis succeed', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } },
        { provide: getRedisConnectionToken(), useValue: { ping: jest.fn().mockResolvedValue('PONG') } },
        { provide: ConfigService, useValue: mockConfig },
        { provide: getQueueToken(VIDEO_PROCESSING_QUEUE), useValue: mockVideoQueue },
        { provide: getQueueToken(MUX_VOD_INGEST_QUEUE), useValue: mockVideoQueue },
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
        { provide: ConfigService, useValue: mockConfig },
        { provide: getQueueToken(VIDEO_PROCESSING_QUEUE), useValue: mockVideoQueue },
        { provide: getQueueToken(MUX_VOD_INGEST_QUEUE), useValue: mockVideoQueue },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);
    const res = await controller.getHealth({} as Parameters<typeof controller.getHealth>[0]);

    expect(res.status).toBe('degraded');
    expect(res.checks.database).toBe('down');
    expect(res.checks.redis).toBe('ok');
  });
});
