import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { MUX_VOD_INGEST_QUEUE } from '../../content/mux-vod.constants';
import { MuxVodIngestJob, MuxVodService } from '../../content/mux-vod.service';
import { Video, VideoStatus } from '../../content/entities/video.entity';

@Processor(MUX_VOD_INGEST_QUEUE)
export class MuxVodIngestWorker extends WorkerHost {
  private readonly logger = new Logger(MuxVodIngestWorker.name);

  constructor(
    private readonly muxVodService: MuxVodService,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
  ) {
    super();
  }

  async process(job: Job<MuxVodIngestJob>): Promise<void> {
    await this.muxVodService.ingestFromS3(job.data);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<MuxVodIngestJob>, err: Error) {
    const maxAttempts =
      typeof job.opts.attempts === 'number' && job.opts.attempts > 0 ? job.opts.attempts : 5;
    if (job.attemptsMade < maxAttempts) return;

    const msg = err?.message?.slice(0, 500) ?? 'Mux ingest failed';
    await this.videoRepository.update(job.data.videoId, {
      status: VideoStatus.FAILED,
      failureReason: msg,
    });
    this.logger.error(
      JSON.stringify({
        msg: 'mux_vod_ingest_failed',
        videoId: job.data.videoId,
        error: msg,
      }),
    );
  }
}
