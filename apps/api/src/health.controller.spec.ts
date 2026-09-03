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
    expect(res.checks.contentScan).toBe('noop');
    expect(res.checks.billing).toBe('stub');
    expect(res.correlationId).toBe('test-corr');
  });

  it('marks contentScan noop_ack when ALLOW_NOOP is set (ADR-012)', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } },
        { provide: getRedisConnectionToken(), useValue: { ping: jest.fn().mockResolvedValue('PONG') } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'video.transcodeProvider') return 'mux';
              if (key === 'contentScan.allowNoop') return true;
              return undefined;
            },
          },
        },
        { provide: getQueueToken(VIDEO_PROCESSING_QUEUE), useValue: mockVideoQueue },
        { provide: getQueueToken(MUX_VOD_INGEST_QUEUE), useValue: mockVideoQueue },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);
    const res = await controller.getHealth({} as Parameters<typeof controller.getHealth>[0]);

    expect(res.status).toBe('ok');
    expect(res.checks.contentScan).toBe('noop_ack');
  });

  it('marks billing stripe when provider and secret key are set', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } },
        { provide: getRedisConnectionToken(), useValue: { ping: jest.fn().mockResolvedValue('PONG') } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'video.transcodeProvider') return 'mux';
              if (key === 'billing.provider') return 'stripe';
              if (key === 'billing.stripeSecretKey') return 'sk_test_x';
              return undefined;
            },
          },
        },
        { provide: getQueueToken(VIDEO_PROCESSING_QUEUE), useValue: mockVideoQueue },
        { provide: getQueueToken(MUX_VOD_INGEST_QUEUE), useValue: mockVideoQueue },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);
    const res = await controller.getHealth({} as Parameters<typeof controller.getHealth>[0]);

    expect(res.checks.billing).toBe('stripe');
  });

  it('marks contentScan misconfigured when webhook is selected without a URL', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } },
        { provide: getRedisConnectionToken(), useValue: { ping: jest.fn().mockResolvedValue('PONG') } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'video.transcodeProvider') return 'mux';
              if (key === 'contentScan.provider') return 'webhook';
              if (key === 'contentScan.webhookUrl') return '';
              return undefined;
            },
          },
        },
        { provide: getQueueToken(VIDEO_PROCESSING_QUEUE), useValue: mockVideoQueue },
        { provide: getQueueToken(MUX_VOD_INGEST_QUEUE), useValue: mockVideoQueue },
      ],
    }).compile();

    const controller = moduleRef.get(HealthController);
    const res = await controller.getHealth({} as Parameters<typeof controller.getHealth>[0]);

    expect(res.status).toBe('degraded');
    expect(res.checks.contentScan).toBe('misconfigured');
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
