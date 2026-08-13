import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  COPYRIGHT_REINSTATEMENT_QUEUE,
  CopyrightReinstatementJob,
} from '../../copyright/copyright-reinstatement.constants';
import { CopyrightService } from '../../copyright/copyright.service';

@Processor(COPYRIGHT_REINSTATEMENT_QUEUE)
export class CopyrightReinstatementWorker extends WorkerHost {
  private readonly logger = new Logger(CopyrightReinstatementWorker.name);

  constructor(private readonly copyrightService: CopyrightService) {
    super();
  }

  async process(_job: Job<CopyrightReinstatementJob>): Promise<void> {
    const { reinstated } = await this.copyrightService.runDueReinstatements();
    if (reinstated > 0) {
      this.logger.log(`Copyright reinstatement scan reinstated ${reinstated} video(s)`);
    }
  }
}
