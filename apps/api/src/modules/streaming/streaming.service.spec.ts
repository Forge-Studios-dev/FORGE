import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StreamingService } from './streaming.service';
import { Stream, StreamStatus, StreamVisibility } from './entities/stream.entity';
import { Video } from '../content/entities/video.entity';
import { MuxVodService } from '../content/mux-vod.service';
import { MuxSigningService } from '../content/mux-signing.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { UserRole } from '../users/entities/user.entity';

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
  let entitlementsService: { checkAccess: jest.Mock; checkAccessMany: jest.Mock };

  const streamRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    entitlementsService = {
      checkAccess: jest.fn(),
      checkAccessMany: jest.fn(),
    };
    streamRepository.findOne.mockReset();
    streamRepository.find.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamingService,
        { provide: getRepositoryToken(Stream), useValue: streamRepository },
        { provide: getRepositoryToken(Video), useValue: { save: jest.fn(), create: jest.fn() } },
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
        { provide: MuxVodService, useValue: { handleAssetReady: jest.fn(), handleAssetErrored: jest.fn() } },
        {
          provide: MuxSigningService,
          useValue: {
            signPlaybackUrl: (url: string) => url,
            playbackPolicyForVisibility: () => ['public'],
          },
        },
        { provide: EntitlementsService, useValue: entitlementsService },
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
});
