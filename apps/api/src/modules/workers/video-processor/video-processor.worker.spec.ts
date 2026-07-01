import { Job } from 'bullmq';
import { VideoProcessorWorker } from './video-processor.worker';

/**
 * The main process() path is ffmpeg/S3-bound and validated via integration; here we
 * unit-test the dead-letter routing in onFailed, which is pure orchestration logic.
 */
describe('VideoProcessorWorker — dead-letter routing', () => {
  let worker: VideoProcessorWorker;
  const videoRepository = { update: jest.fn(), findOne: jest.fn() };
  const deadLetterQueue = { add: jest.fn().mockResolvedValue(undefined) };
  const redis = { del: jest.fn() };
  const configService = {
    get: jest.fn((key: string) => (key === 'aws.region' ? 'us-east-1' : '')),
  };
  const eventEmitter = { emit: jest.fn() };

  const makeJob = (attemptsMade: number, attempts = 5): Job =>
    ({
      id: 'job-1',
      data: { videoId: 'video-1', s3Key: 'uploads/v.mp4', userId: 'user-1' },
      opts: { attempts },
      attemptsMade,
    }) as unknown as Job;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new VideoProcessorWorker(
      videoRepository as never,
      deadLetterQueue as never,
      redis as never,
      configService as never,
      eventEmitter as never,
    );
  });

  it('does not route to the DLQ while retries remain', async () => {
    await worker.onFailed(makeJob(1), new Error('transcode failed'));
    expect(deadLetterQueue.add).not.toHaveBeenCalled();
  });

  it('routes the job to the dead-letter queue once attempts are exhausted', async () => {
    await worker.onFailed(makeJob(5), new Error('transcode failed'));
    expect(deadLetterQueue.add).toHaveBeenCalledWith(
      'dead',
      expect.objectContaining({
        videoId: 'video-1',
        originalJobId: 'job-1',
        failedReason: 'transcode failed',
      }),
      expect.objectContaining({ jobId: expect.stringContaining('dlq-job-1') }),
    );
  });
});
