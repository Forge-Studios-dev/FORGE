import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { MuxVodService } from './mux-vod.service';
import { Video, VideoStatus, TranscodeProvider } from './entities/video.entity';
import { muxHlsPlaybackUrl, muxThumbnailUrl } from './mux-vod.constants';
import { MuxSigningService } from './mux-signing.service';

const mockMuxCreate = jest.fn();
const mockMuxDelete = jest.fn();
jest.mock('@mux/mux-node', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    video: {
      assets: {
        create: mockMuxCreate,
        delete: mockMuxDelete,
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

  beforeEach(async () => {
    jest.clearAllMocks();
    mockMuxCreate.mockResolvedValue({ id: 'mux-asset-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MuxVodService,
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
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: MuxSigningService,
          useValue: { playbackPolicyForVisibility: jest.fn().mockReturnValue(['public']) },
        },
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

  it('deleteAsset calls Mux API when configured', async () => {
    mockMuxDelete.mockResolvedValue(undefined);
    await service.deleteAsset('mux-asset-1');
    expect(mockMuxDelete).toHaveBeenCalledWith('mux-asset-1');
  });
});
