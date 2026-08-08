import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StreamingService } from './streaming.service';
import { Stream, StreamEndReason, StreamStatus, StreamVisibility } from './entities/stream.entity';
import { Video, VideoVisibility } from '../content/entities/video.entity';
import { MuxVodService } from '../content/mux-vod.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { User, UserRole } from '../users/entities/user.entity';
import { StreamEventPurchase } from './entities/stream-event-purchase.entity';
import { Community } from '../communities/entities/community.entity';
import { AccessSessionsService } from '../access-sessions/access-sessions.service';
import { WebhookIdempotencyService } from '../../common/webhooks/webhook-idempotency.service';
import { StreamViewerService } from './stream-viewer.service';
import { MuxLiveSyncService } from './mux-live-sync.service';
import { StreamReminderScheduler } from './stream-reminder.scheduler';
import { EngagementService } from '../engagement/engagement.service';
import { getQueueToken } from '@nestjs/bullmq';
import { PREMIUM_CONTENT_NOTIFY_QUEUE } from '../workers/premium-content-notify/premium-content-notify.constants';

function mockStream(overrides: Partial<Stream> = {}): Stream {
  return {
    id: 'stream-1',
    userId: 'creator-1',
    title: 'Test live',
    description: null,
    muxStreamId: null,
    muxLiveStreamId: 'mock-stream-id',
    muxAssetId: null,
    streamKey: 'key',
    rtmpUrl: 'rtmps://example/app',
    playbackUrl: 'https://stream.mux.com/test.m3u8',
    thumbnailUrl: null,
    status: StreamStatus.LIVE,
    visibility: StreamVisibility.SUBSCRIBERS,
    categoryId: null,
    chatEnabled: true,
    recordEnabled: true,
    ageRestricted: false,
    requiredTierId: null,
    slowModeSeconds: 0,
    viewerCount: 0,
    startedAt: new Date(),
    endedAt: null,
    createdAt: new Date(),
    user: undefined,
    ...overrides,
  } as Stream;
}

describe('StreamingService access gating', () => {
  let service: StreamingService;
  let entitlementsService: {
    checkAccess: jest.Mock;
    checkAccessMany: jest.Mock;
    verifyMediaTierEntitlements: jest.Mock;
  };

  const streamRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  };
  const videoRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    entitlementsService = {
      checkAccess: jest.fn(),
      checkAccessMany: jest.fn(),
      verifyMediaTierEntitlements: jest.fn().mockResolvedValue(true),
    };
    streamRepository.findOne.mockReset();
    streamRepository.find.mockReset();
    videoRepository.findOne.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamingService,
        { provide: getRepositoryToken(Stream), useValue: streamRepository },
        { provide: getRepositoryToken(Video), useValue: videoRepository },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn().mockResolvedValue({ matureContentAcknowledgedAt: new Date() }) },
        },
        {
          provide: getRepositoryToken(StreamEventPurchase),
          useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() },
        },
        {
          provide: getRepositoryToken(Community),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string> = {
                nodeEnv: 'test',
                'mux.tokenId': 'placeholder',
                'mux.tokenSecret': 'placeholder',
              };
              return map[key];
            },
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: MuxVodService, useValue: { handleAssetReady: jest.fn(), handleAssetErrored: jest.fn(), handleTrackReady: jest.fn() } },
        { provide: EntitlementsService, useValue: entitlementsService },
        {
          provide: AccessSessionsService,
          useValue: { requirePremiumSession: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: WebhookIdempotencyService,
          useValue: {
            isDuplicate: jest.fn().mockResolvedValue(false),
            markProcessed: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MuxLiveSyncService,
          useValue: {
            handleWebhookActive: jest.fn(),
            handleWebhookIdle: jest.fn(),
            clearPlatformDormant: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: StreamViewerService,
          useValue: {
            trackStreamLive: jest.fn().mockResolvedValue(undefined),
            trackStreamEnded: jest.fn().mockResolvedValue(undefined),
            finalizeUniqueViewers: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: StreamReminderScheduler,
          useValue: {
            scheduleReminder: jest.fn().mockResolvedValue(undefined),
            cancelReminder: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EngagementService,
          useValue: {
            getBlockedPeerIds: jest.fn().mockResolvedValue([]),
            isBlockedEitherWay: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            setex: jest.fn().mockResolvedValue('OK'),
            del: jest.fn(),
            scan: jest.fn().mockResolvedValue(['0', []]),
          },
        },
        {
          provide: getQueueToken(PREMIUM_CONTENT_NOTIFY_QUEUE),
          useValue: { add: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(StreamingService);
  });

  describe('getStreamForViewer', () => {
    it('returns playback URL when access is allowed', async () => {
      const stream = mockStream();
      streamRepository.findOne.mockResolvedValue(stream);
      entitlementsService.checkAccess.mockResolvedValue({ allowed: true });

      const result = await service.getStreamForViewer('stream-1', 'viewer-1');

      expect(result.playbackUrl).toBe(stream.playbackUrl);
      expect(result.accessDenied).toBeFalsy();
      expect(result.thumbnailUrl).toContain('image.mux.com/test');
    });

    it('hides playback and sets accessDenied when not entitled', async () => {
      const stream = mockStream();
      streamRepository.findOne.mockResolvedValue(stream);
      entitlementsService.checkAccess.mockResolvedValue({
        allowed: false,
        reason: 'subscription_required',
      });

      const result = await service.getStreamForViewer('stream-1', 'viewer-1');

      expect(result.playbackUrl).toBeNull();
      expect(result.accessDenied).toBe(true);
      expect(result.accessReason).toBe('subscription_required');
    });

    it('includes ingest credentials for stream owner', async () => {
      const stream = mockStream({ userId: 'creator-1' });
      streamRepository.findOne.mockResolvedValue(stream);
      entitlementsService.checkAccess.mockResolvedValue({ allowed: true });

      const result = await service.getStreamForViewer('stream-1', 'creator-1', UserRole.CREATOR);

      expect(result.streamKey).toBe('key');
      expect(result.rtmpUrl).toBe('rtmps://example/app');
    });

    it('hides playback URL while stream is idle', async () => {
      const stream = mockStream({ status: StreamStatus.IDLE });
      streamRepository.findOne.mockResolvedValue(stream);
      entitlementsService.checkAccess.mockResolvedValue({ allowed: true });

      const result = await service.getStreamForViewer('stream-1', 'viewer-1');

      expect(result.playbackUrl).toBeNull();
      expect(result.status).toBe(StreamStatus.IDLE);
    });
  });

  describe('getLiveStreams', () => {
    it('omits non-public streams when viewer has no access', async () => {
      const gated = mockStream({ id: 'gated', visibility: StreamVisibility.TIER });
      streamRepository.find.mockResolvedValue([gated]);
      entitlementsService.checkAccessMany.mockResolvedValue([
        { allowed: false, reason: 'tier_required' },
      ]);

      const results = await service.getLiveStreams('viewer-1');

      expect(results).toHaveLength(0);
      expect(entitlementsService.checkAccessMany).toHaveBeenCalled();
    });

    it('includes gated streams with accessDenied when viewer is entitled', async () => {
      const gated = mockStream({ id: 'gated', visibility: StreamVisibility.SUBSCRIBERS });
      streamRepository.find.mockResolvedValue([gated]);
      entitlementsService.checkAccessMany.mockResolvedValue([{ allowed: true }]);

      const results = await service.getLiveStreams('viewer-1');

      expect(results).toHaveLength(1);
      expect(results[0].playbackUrl).toBe(gated.playbackUrl);
    });
  });

  describe('getStreamReplayVideo', () => {
    it('returns accessDenied without hlsUrl for non-entitled viewers', async () => {
      const stream = mockStream({ visibility: StreamVisibility.PAID_EVENT });
      const video = {
        id: 'v1',
        title: 'Replay',
        hlsUrl: 'https://stream.mux.com/replay.m3u8',
        thumbnailUrl: null,
        publishedAt: new Date(),
        visibility: VideoVisibility.PAID_EVENT,
        muxPlaybackId: 'replay',
      };
      streamRepository.findOne.mockResolvedValue(stream);
      videoRepository.findOne.mockResolvedValue(video);
      entitlementsService.checkAccess.mockResolvedValue({
        allowed: false,
        reason: 'paid_event',
      });

      const result = await service.getStreamReplayVideo('stream-1', 'viewer-1');

      expect(result?.accessDenied).toBe(true);
      expect(result?.hlsUrl).toBeNull();
    });
  });
});

describe('StreamingService endStream', () => {
  it('emits stream.ended after manual end', async () => {
    const emit = jest.fn();
    const stream = mockStream({ userId: 'creator-1', status: StreamStatus.LIVE });
    const streamRepository = {
      findOne: jest.fn().mockResolvedValue(stream),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
    };

    const service = new StreamingService(
      streamRepository as never,
      { save: jest.fn(), create: jest.fn() } as never,
      { findOne: jest.fn() } as never,
      { findOne: jest.fn(), save: jest.fn(), create: jest.fn() } as never,
      { findOne: jest.fn() } as never,
      {
        get: (key: string) => (key === 'nodeEnv' ? 'test' : 'placeholder'),
      } as never,
      { emit } as never,
      { handleAssetReady: jest.fn(), handleAssetErrored: jest.fn(), handleTrackReady: jest.fn() } as never,
      { checkAccess: jest.fn(), checkAccessMany: jest.fn() } as never,
      { requirePremiumSession: jest.fn().mockResolvedValue(undefined) } as never,
      {
        isDuplicate: jest.fn().mockResolvedValue(false),
        markProcessed: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        trackStreamLive: jest.fn().mockResolvedValue(undefined),
        trackStreamEnded: jest.fn().mockResolvedValue(undefined),
        finalizeUniqueViewers: jest.fn().mockResolvedValue(0),
      } as never,
      {
        handleWebhookActive: jest.fn(),
        handleWebhookIdle: jest.fn(),
      } as never,
      {
        scheduleReminder: jest.fn().mockResolvedValue(undefined),
        cancelReminder: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        getBlockedPeerIds: jest.fn().mockResolvedValue([]),
        isBlockedEitherWay: jest.fn().mockResolvedValue(false),
      } as never,
      {
        get: jest.fn().mockResolvedValue(null),
        setex: jest.fn().mockResolvedValue('OK'),
        del: jest.fn(),
        scan: jest.fn().mockResolvedValue(['0', []]),
      } as never,
      { add: jest.fn() } as never,
    );

    jest.spyOn(service['mux'].video.liveStreams, 'disable').mockResolvedValue({} as never);

    await service.endStream('creator-1', 'stream-1');

    expect(emit).toHaveBeenCalledWith(
      'stream.ended',
      expect.objectContaining({
        streamId: 'stream-1',
        userId: 'creator-1',
        endReason: StreamEndReason.HOST_ENDED,
      }),
    );
  });
});

describe('StreamingService createStream', () => {
  const streamRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    create: jest.fn((dto) => dto),
  };

  it('throws in production when Mux live stream creation fails', async () => {
    const muxError = new Error('Mux API error');
    const service = new StreamingService(
      streamRepository as never,
      { save: jest.fn(), create: jest.fn() } as never,
      { findOne: jest.fn() } as never,
      { findOne: jest.fn(), save: jest.fn(), create: jest.fn() } as never,
      { findOne: jest.fn() } as never,
      {
        get: (key: string) => {
          const map: Record<string, string> = {
            nodeEnv: 'production',
            'mux.tokenId': 'real-token',
            'mux.tokenSecret': 'real-secret',
          };
          return map[key];
        },
      } as never,
      { emit: jest.fn() } as never,
      { handleAssetReady: jest.fn(), handleAssetErrored: jest.fn(), handleTrackReady: jest.fn() } as never,
      { checkAccess: jest.fn(), checkAccessMany: jest.fn() } as never,
      { requirePremiumSession: jest.fn().mockResolvedValue(undefined) } as never,
      {
        isDuplicate: jest.fn().mockResolvedValue(false),
        markProcessed: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        trackStreamLive: jest.fn().mockResolvedValue(undefined),
        trackStreamEnded: jest.fn().mockResolvedValue(undefined),
        finalizeUniqueViewers: jest.fn().mockResolvedValue(0),
      } as never,
      {
        handleWebhookActive: jest.fn(),
        handleWebhookIdle: jest.fn(),
      } as never,
      {
        scheduleReminder: jest.fn().mockResolvedValue(undefined),
        cancelReminder: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        getBlockedPeerIds: jest.fn().mockResolvedValue([]),
        isBlockedEitherWay: jest.fn().mockResolvedValue(false),
      } as never,
      {
        get: jest.fn().mockResolvedValue(null),
        setex: jest.fn().mockResolvedValue('OK'),
        del: jest.fn(),
        scan: jest.fn().mockResolvedValue(['0', []]),
      } as never,
      { add: jest.fn() } as never,
    );

    jest.spyOn(service['mux'].video.liveStreams, 'create').mockRejectedValue(muxError);

    await expect(service.createStream('user-1', { title: 'Live session' })).rejects.toThrow(
      'Live streaming is temporarily unavailable',
    );
    expect(streamRepository.save).not.toHaveBeenCalled();
  });
});
