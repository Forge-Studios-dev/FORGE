import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { MuxVodService } from './mux-vod.service';
import { Video, VideoStatus, TranscodeProvider, VideoType, VideoVisibility } from './entities/video.entity';
import { muxHlsPlaybackUrl, muxThumbnailUrl } from './mux-vod.constants';
import { SHORT_TOO_LONG_MESSAGE } from './short-duration.util';
import { ContentScanService } from './content-scan/content-scan.service';

const mockMuxCreate = jest.fn();
const mockMuxDelete = jest.fn();
const mockMuxCreatePlaybackId = jest.fn();
const mockMuxDeletePlaybackId = jest.fn();
jest.mock('@mux/mux-node', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    video: {
      assets: {
        create: mockMuxCreate,
        delete: mockMuxDelete,
        createPlaybackId: mockMuxCreatePlaybackId,
        deletePlaybackId: mockMuxDeletePlaybackId,
      },
    },
  })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/signed'),
}));

describe('MuxVodService', () => {
  let service: MuxVodService;
  const videoRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const eventEmitter = { emit: jest.fn() };
  const contentScanService = {
    scanVideo: jest.fn().mockResolvedValue({ action: 'approve', categories: [], provider: 'noop' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockMuxCreate.mockResolvedValue({ id: 'mux-asset-1' });
    contentScanService.scanVideo.mockResolvedValue({ action: 'approve', categories: [], provider: 'noop' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MuxVodService,
        { provide: ContentScanService, useValue: contentScanService },
        {
          provide: getRepositoryToken(Video),
          useValue: videoRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string | number> = {
                'aws.region': 'ap-south-1',
                'aws.accessKeyId': 'key',
                'aws.secretAccessKey': 'secret',
                'aws.s3BucketName': 'bucket',
                'mux.tokenId': 'token-id',
                'mux.tokenSecret': 'token-secret',
                'video.muxIngestUrlTtlSec': 3600,
              };
              return map[key];
            },
          },
        },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: getRedisConnectionToken(), useValue: { del: jest.fn() } },
      ],
    }).compile();

    service = module.get(MuxVodService);
  });

  it('builds mux playback URLs', () => {
    expect(muxHlsPlaybackUrl('pb1')).toBe('https://stream.mux.com/pb1.m3u8');
    expect(muxThumbnailUrl('pb1')).toContain('image.mux.com/pb1');
  });

  it('handleAssetReady updates video when passthrough matches', async () => {
    const video = {
      id: 'video-uuid',
      userId: 'user-1',
      categoryId: null,
      status: VideoStatus.PROCESSING,
      scheduledPublishAt: null,
    } as Video;
    videoRepo.findOne.mockResolvedValue(video);
    videoRepo.update.mockResolvedValue({});

    const handled = await service.handleAssetReady({
      data: {
        id: 'mux-asset-1',
        passthrough: 'video-uuid',
        playback_ids: [{ id: 'pb1' }],
        duration: 120.5,
      },
    });

    expect(handled).toBe(true);
    expect(videoRepo.update).toHaveBeenCalledWith(
      'video-uuid',
      expect.objectContaining({
        status: VideoStatus.READY,
        hlsUrl: 'https://stream.mux.com/pb1.m3u8',
        muxPlaybackId: 'pb1',
        transcodeProvider: TranscodeProvider.MUX,
      }),
    );
  });

  it('handleAssetErrored marks video failed', async () => {
    videoRepo.findOne.mockResolvedValue({ id: 'video-uuid' } as Video);
    const handled = await service.handleAssetErrored({
      data: {
        id: 'mux-asset-1',
        passthrough: 'video-uuid',
        errors: { messages: ['encoding failed'] },
      },
    });
    expect(handled).toBe(true);
    expect(videoRepo.update).toHaveBeenCalledWith(
      'video-uuid',
      expect.objectContaining({ status: VideoStatus.FAILED }),
    );
  });

  it('handleAssetReady rejects short intent when duration exceeds 60s', async () => {
    const video = {
      id: 'video-uuid',
      userId: 'user-1',
      categoryId: null,
      status: VideoStatus.PROCESSING,
      scheduledPublishAt: null,
      videoType: VideoType.SHORT,
      muxPlaybackId: null,
    } as Video;
    videoRepo.findOne.mockResolvedValue(video);
    videoRepo.update.mockResolvedValue({});

    const handled = await service.handleAssetReady({
      data: {
        id: 'mux-asset-1',
        passthrough: 'video-uuid',
        playback_ids: [{ id: 'pb1' }],
        duration: 61,
      },
    });

    expect(handled).toBe(true);
    expect(videoRepo.update).toHaveBeenCalledWith(
      'video-uuid',
      expect.objectContaining({
        status: VideoStatus.FAILED,
        durationSeconds: 61,
        failureReason: SHORT_TOO_LONG_MESSAGE,
      }),
    );
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      'video.ready',
      expect.anything(),
    );
  });

  it('handleAssetReady stores captionUrl when text track is ready', async () => {
    const video = {
      id: 'video-uuid',
      userId: 'user-1',
      categoryId: null,
      status: VideoStatus.PROCESSING,
      scheduledPublishAt: null,
    } as Video;
    videoRepo.findOne.mockResolvedValue(video);
    videoRepo.update.mockResolvedValue({});

    await service.handleAssetReady({
      data: {
        id: 'mux-asset-1',
        passthrough: 'video-uuid',
        playback_ids: [{ id: 'pb1' }],
        duration: 60,
        tracks: [{ id: 'track-1', type: 'text', text_type: 'subtitles', status: 'ready' }],
      },
    });

    expect(videoRepo.update).toHaveBeenCalledWith(
      'video-uuid',
      expect.objectContaining({
        captionUrl: 'https://stream.mux.com/pb1/text/track-1.vtt',
      }),
    );
  });

  it('handleTrackReady attaches caption after asset ready', async () => {
    videoRepo.findOne.mockResolvedValue({
      id: 'video-uuid',
      muxPlaybackId: 'pb1',
      captionUrl: null,
      captionTracks: null,
    } as Video);
    videoRepo.update.mockResolvedValue({});

    await service.handleTrackReady({
      data: {
        id: 'track-9',
        type: 'text',
        text_type: 'captions',
        status: 'ready',
        asset_id: 'mux-asset-1',
        language_code: 'es',
        name: 'Spanish',
      },
    });

    expect(videoRepo.update).toHaveBeenCalledWith(
      'video-uuid',
      expect.objectContaining({
        captionUrl: 'https://stream.mux.com/pb1/text/track-9.vtt',
        captionTracks: [
          { language: 'es', label: 'Spanish', url: 'https://stream.mux.com/pb1/text/track-9.vtt' },
        ],
      }),
    );
  });

  it('deleteAsset calls Mux API when configured', async () => {
    mockMuxDelete.mockResolvedValue(undefined);
    await service.deleteAsset('mux-asset-1');
    expect(mockMuxDelete).toHaveBeenCalledWith('mux-asset-1');
  });

  describe('ingestFromS3 playback policy', () => {
    it('ingests a public video with a public playback policy', async () => {
      videoRepo.findOne.mockResolvedValue({
        id: 'video-uuid',
        muxAssetId: null,
        visibility: VideoVisibility.PUBLIC,
      } as Video);
      videoRepo.update.mockResolvedValue({});

      await service.ingestFromS3({ videoId: 'video-uuid', s3Key: 'key', userId: 'user-1' });

      expect(mockMuxCreate).toHaveBeenCalledWith(
        expect.objectContaining({ playback_policy: ['public'] }),
      );
    });

    it('ingests a private/gated video with a signed playback policy', async () => {
      videoRepo.findOne.mockResolvedValue({
        id: 'video-uuid',
        muxAssetId: null,
        visibility: VideoVisibility.TIER,
      } as Video);
      videoRepo.update.mockResolvedValue({});

      await service.ingestFromS3({ videoId: 'video-uuid', s3Key: 'key', userId: 'user-1' });

      expect(mockMuxCreate).toHaveBeenCalledWith(
        expect.objectContaining({ playback_policy: ['signed'] }),
      );
    });
  });

  describe('syncPlaybackPolicy', () => {
    it('re-issues a signed playback id and deletes the old public one when visibility tightens', async () => {
      mockMuxCreatePlaybackId.mockResolvedValue({ id: 'pb-new' });
      mockMuxDeletePlaybackId.mockResolvedValue(undefined);
      const video = {
        id: 'video-uuid',
        muxAssetId: 'mux-asset-1',
        muxPlaybackId: 'pb-old',
        visibility: VideoVisibility.PRIVATE,
        captionUrl: 'https://stream.mux.com/pb-old/text/track-1.vtt',
        captionTracks: [
          { language: 'en', label: 'English', url: 'https://stream.mux.com/pb-old/text/track-1.vtt' },
        ],
      } as unknown as Video;

      await service.syncPlaybackPolicy(video);

      expect(mockMuxCreatePlaybackId).toHaveBeenCalledWith('mux-asset-1', { policy: 'signed' });
      expect(mockMuxDeletePlaybackId).toHaveBeenCalledWith('mux-asset-1', 'pb-old');
      expect(video.muxPlaybackId).toBe('pb-new');
      expect(video.hlsUrl).toBe('https://stream.mux.com/pb-new.m3u8');
      expect(video.captionUrl).toBe('https://stream.mux.com/pb-new/text/track-1.vtt');
      expect(video.captionTracks?.[0]?.url).toBe('https://stream.mux.com/pb-new/text/track-1.vtt');
    });

    it('is a no-op when the video has no Mux asset yet', async () => {
      const video = {
        id: 'video-uuid',
        muxAssetId: null,
        muxPlaybackId: null,
        visibility: VideoVisibility.PRIVATE,
      } as unknown as Video;

      await service.syncPlaybackPolicy(video);

      expect(mockMuxCreatePlaybackId).not.toHaveBeenCalled();
    });
  });
});
