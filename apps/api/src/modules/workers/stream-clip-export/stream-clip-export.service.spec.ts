import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StreamClipExportService } from './stream-clip-export.service';
import { STREAM_CLIP_EXPORT_QUEUE } from './stream-clip-export.constants';
import { StreamClip } from '../../streaming/entities/stream-clip.entity';
import { Stream } from '../../streaming/entities/stream.entity';

const muxAssetsCreate = jest.fn();

jest.mock('@mux/mux-node', () => {
  return jest.fn().mockImplementation(() => ({
    video: {
      assets: {
        create: (...args: unknown[]) => muxAssetsCreate(...args),
      },
    },
  }));
});

describe('StreamClipExportService', () => {
  let service: StreamClipExportService;
  const clipRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const streamRepository = {
    findOne: jest.fn(),
  };
  const exportQueue = {
    add: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'mux.tokenId') return 'tok';
      if (key === 'mux.tokenSecret') return 'sec';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamClipExportService,
        { provide: getRepositoryToken(StreamClip), useValue: clipRepository },
        { provide: getRepositoryToken(Stream), useValue: streamRepository },
        { provide: getQueueToken(STREAM_CLIP_EXPORT_QUEUE), useValue: exportQueue },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    service = module.get(StreamClipExportService);
  });

  it('defers export when the stream has no Mux source asset yet', async () => {
    clipRepository.findOne.mockResolvedValue({
      id: 'c1',
      streamId: 's1',
      startOffsetMs: 0,
      endOffsetMs: 30_000,
      status: 'marked',
    });
    streamRepository.findOne.mockResolvedValue({ id: 's1', muxAssetId: null });

    await service.exportClip('c1');

    expect(clipRepository.update).toHaveBeenCalledWith('c1', {
      status: 'marked',
      exportError: null,
    });
    expect(muxAssetsCreate).not.toHaveBeenCalled();
  });

  it('creates a Mux clip asset and marks ready when playback id is returned', async () => {
    clipRepository.findOne.mockResolvedValue({
      id: 'c1',
      streamId: 's1',
      startOffsetMs: 10_000,
      endOffsetMs: 40_000,
      status: 'exporting',
    });
    streamRepository.findOne.mockResolvedValue({ id: 's1', muxAssetId: 'asset-src' });
    muxAssetsCreate.mockResolvedValue({
      id: 'clip-asset',
      playback_ids: [{ id: 'pb1' }],
    });

    await service.exportClip('c1');

    expect(muxAssetsCreate).toHaveBeenCalled();
    expect(clipRepository.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        muxClipAssetId: 'clip-asset',
        playbackUrl: 'https://stream.mux.com/pb1.m3u8',
        status: 'ready',
      }),
    );
  });

  it('handleClipAssetReady updates the clip from Mux webhook passthrough', async () => {
    const handled = await service.handleClipAssetReady({
      data: {
        id: 'clip-asset',
        passthrough: 'forge-clip:c1',
        playback_ids: [{ id: 'pb9', policy: 'public' }],
      },
    });
    expect(handled).toBe(true);
    expect(clipRepository.update).toHaveBeenCalledWith(
      { id: 'c1' },
      expect.objectContaining({
        playbackUrl: 'https://stream.mux.com/pb9.m3u8',
        status: 'ready',
      }),
    );
  });

  it('handleClipAssetReady ignores non-clip assets', async () => {
    const handled = await service.handleClipAssetReady({
      data: { id: 'other', passthrough: 'video-123' },
    });
    expect(handled).toBe(false);
    expect(clipRepository.update).not.toHaveBeenCalled();
  });
});
