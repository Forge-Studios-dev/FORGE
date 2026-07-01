import { Job } from 'bullmq';
import { MuxVodIngestWorker } from './mux-vod-ingest.worker';
import { MuxVodIngestJob } from '../../content/mux-vod.service';
import { VideoStatus } from '../../content/entities/video.entity';

describe('MuxVodIngestWorker', () => {
  let worker: MuxVodIngestWorker;
  const muxVodService = { ingestFromS3: jest.fn().mockResolvedValue(undefined) };
  const videoRepository = { update: jest.fn().mockResolvedValue(undefined) };

  const makeJob = (
    overrides: Partial<Job<MuxVodIngestJob>> = {},
  ): Job<MuxVodIngestJob> =>
    ({
      data: { videoId: 'video-1' },
      opts: { attempts: 5 },
      attemptsMade: 0,
      ...overrides,
    }) as unknown as Job<MuxVodIngestJob>;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new MuxVodIngestWorker(muxVodService as never, videoRepository as never);
  });

  it('delegates ingest to the Mux VOD service', async () => {
    await worker.process(makeJob());
    expect(muxVodService.ingestFromS3).toHaveBeenCalledWith({ videoId: 'video-1' });
  });

  it('does not mark the video failed while retries remain', async () => {
    await worker.onFailed(makeJob({ attemptsMade: 2 }), new Error('mux timeout'));
    expect(videoRepository.update).not.toHaveBeenCalled();
  });

  it('marks the video FAILED once all attempts are exhausted', async () => {
    await worker.onFailed(makeJob({ attemptsMade: 5 }), new Error('mux asset error'));
    expect(videoRepository.update).toHaveBeenCalledWith(
      'video-1',
      expect.objectContaining({ status: VideoStatus.FAILED, failureReason: 'mux asset error' }),
    );
  });
});
