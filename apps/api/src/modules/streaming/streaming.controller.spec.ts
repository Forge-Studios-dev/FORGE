import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { StreamingController } from './streaming.controller';
import { StreamingService } from './streaming.service';
import { StreamLiveService } from './stream-live.service';
import { BillingService } from '../billing/billing.service';
import { UsersService } from '../users/users.service';
import { StreamReactionService } from './stream-reaction.service';
import { StreamAnalyticsService } from './stream-analytics.service';
import { AiCommunityService } from '../communities/ai-community.service';
import { StreamBreakoutService } from './stream-breakout.service';
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
  const breakoutService = {
    createBreakoutRooms: jest.fn(),
    listBreakoutRooms: jest.fn(),
    endBreakoutSession: jest.fn(),
  };

  async function createController(nodeEnv = 'production') {
    const moduleRef = await Test.createTestingModule({
      controllers: [StreamingController],
      providers: [
        { provide: StreamingService, useValue: streamingService },
        { provide: StreamLiveService, useValue: {} },
        { provide: BillingService, useValue: { createEventCheckout: jest.fn() } },
        { provide: UsersService, useValue: { resolveUserId: jest.fn() } },
        { provide: StreamReactionService, useValue: {} },
        { provide: StreamAnalyticsService, useValue: { getCreatorStreamAnalytics: jest.fn(), recordSnapshot: jest.fn() } },
        { provide: AiCommunityService, useValue: { generateStreamSummary: jest.fn() } },
        { provide: StreamBreakoutService, useValue: breakoutService },
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

  it('lists breakout rooms using communityId query input', async () => {
    const controller = await createController();
    breakoutService.listBreakoutRooms.mockResolvedValue([{ id: 'room-1' }]);

    const result = await controller.listBreakoutRooms(
      { sub: 'user-1', role: 'creator' } as never,
      '00000000-0000-4000-8000-0000000000a1',
      '00000000-0000-4000-8000-0000000000b2',
    );

    expect(breakoutService.listBreakoutRooms).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-0000000000a1',
      '00000000-0000-4000-8000-0000000000b2',
    );
    expect(result).toEqual([{ id: 'room-1' }]);
  });
});
