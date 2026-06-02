import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { StreamingController } from './streaming.controller';
import { StreamingService } from './streaming.service';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

function signMuxBody(body: string, secret: string): string {
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${body}`, 'utf8').digest('hex');
  return `t=${t},v1=${sig}`;
}

describe('StreamingController Mux webhook', () => {
  const secret = 'test-webhook-secret';
  const streamingService = {
    handleMuxWebhook: jest.fn().mockResolvedValue({ ok: true }),
  };

  async function createController(nodeEnv = 'production') {
    const moduleRef = await Test.createTestingModule({
      controllers: [StreamingController],
      providers: [
        { provide: StreamingService, useValue: streamingService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string> = {
                'mux.webhookSecret': secret,
                'mux.tokenId': 'token-id',
                'mux.tokenSecret': 'token-secret',
                nodeEnv,
              };
              return map[key];
            },
          },
        },
      ],
    })
      .overrideGuard(CreatorApprovedGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    return moduleRef.get(StreamingController);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts valid mux-signature on raw body', async () => {
    const controller = await createController();
    const body = JSON.stringify({
      type: 'video.asset.ready',
      data: { id: 'asset-1', passthrough: 'video-1', playback_ids: [{ id: 'pb1' }] },
    });
    const req = {
      rawBody: Buffer.from(body, 'utf-8'),
      headers: { 'mux-signature': signMuxBody(body, secret) },
    };

    await controller.handleMuxWebhook(req, {});

    expect(streamingService.handleMuxWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'video.asset.ready' }),
    );
  });

  it('rejects invalid signature', async () => {
    const controller = await createController();
    const body = JSON.stringify({ type: 'video.asset.ready', data: {} });
    const req = {
      rawBody: Buffer.from(body, 'utf-8'),
      headers: { 'mux-signature': 't=1,v1=deadbeef' },
    };

    expect(() => controller.handleMuxWebhook(req, {})).toThrow(ForbiddenException);
  });

  it('rejects when raw body is missing in production', async () => {
    const controller = await createController();
    expect(() =>
      controller.handleMuxWebhook({ headers: { 'mux-signature': 't=1,v1=x' } }, { type: 'x' }),
    ).toThrow(ForbiddenException);
  });
});
