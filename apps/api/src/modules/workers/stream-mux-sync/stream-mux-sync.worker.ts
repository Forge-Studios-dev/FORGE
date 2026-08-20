import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MuxLiveSyncService } from '../../streaming/mux-live-sync.service';
import { StreamMuxSyncScheduler } from '../../streaming/stream-mux-sync.scheduler';
import { STREAM_MUX_SYNC_QUEUE, StreamMuxSyncJob } from './stream-mux-sync.constants';

@Processor(STREAM_MUX_SYNC_QUEUE, { concurrency: 1 })
export class StreamMuxSyncWorker extends WorkerHost {
  private readonly logger = new Logger(StreamMuxSyncWorker.name);

  constructor(
    private readonly muxLiveSyncService: MuxLiveSyncService,
    private readonly muxSyncScheduler: StreamMuxSyncScheduler,
  ) {
    super();
  }

  async process(job: Job<StreamMuxSyncJob>): Promise<void> {
    if (job.data.disableMuxLiveStreamId) {
      await this.muxLiveSyncService.retryDisableLiveStream(job.data.disableMuxLiveStreamId);
      return;
    }

    if (job.data.finalizeStreamId) {
      await this.muxLiveSyncService.finalizeIfGraceExpired(job.data.finalizeStreamId);
      return;
    }

    if (job.data.streamId) {
      await this.muxLiveSyncService.syncStreamById(job.data.streamId);
      return;
    }

    const result = await this.muxLiveSyncService.runPeriodicScan();
    const isDormant = await this.muxLiveSyncService.isPlatformDormant();
    const hasLive = isDormant
      ? false
      : await this.muxLiveSyncService.hasActiveLiveStreams();
    await this.muxSyncScheduler.syncIntervalForActivity({ hasLiveStreams: hasLive, isDormant });
    this.logger.debug(
      `Mux backup scan: ${result.synced} idle synced, ${result.finalized} finalized (live=${hasLive})`,
    );
  }
}
