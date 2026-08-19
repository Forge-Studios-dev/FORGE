import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  SHORTS_WATCH_PERCENT_QUEUE,
  ShortsWatchPercentJob,
} from '../../content/shorts-watch-percent.constants';
import { ShortsWatchPercentService } from '../../content/shorts-watch-percent.service';

@Processor(SHORTS_WATCH_PERCENT_QUEUE)
export class ShortsWatchPercentWorker extends WorkerHost {
  private readonly logger = new Logger(ShortsWatchPercentWorker.name);

  constructor(private readonly shortsWatchPercent: ShortsWatchPercentService) {
    super();
  }

  async process(_job: Job<ShortsWatchPercentJob>): Promise<void> {
    const { updated } = await this.shortsWatchPercent.recompute();
    if (updated > 0) {
      this.logger.log(`Shorts watch-percent recompute updated ${updated} video(s)`);
    }
  }
}
