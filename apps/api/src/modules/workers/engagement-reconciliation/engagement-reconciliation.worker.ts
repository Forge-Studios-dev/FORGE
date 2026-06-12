import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  ENGAGEMENT_RECONCILIATION_QUEUE,
  EngagementReconciliationJob,
} from '../../engagement/engagement-reconciliation.constants';
import { EngagementReconciliationService } from '../../engagement/engagement-reconciliation.service';

@Processor(ENGAGEMENT_RECONCILIATION_QUEUE)
export class EngagementReconciliationWorker extends WorkerHost {
  private readonly logger = new Logger(EngagementReconciliationWorker.name);

  constructor(private readonly reconciliation: EngagementReconciliationService) {
    super();
  }

  async process(_job: Job<EngagementReconciliationJob>): Promise<void> {
    this.logger.debug('Running engagement count reconciliation');
    await this.reconciliation.reconcileAll();
  }
}
