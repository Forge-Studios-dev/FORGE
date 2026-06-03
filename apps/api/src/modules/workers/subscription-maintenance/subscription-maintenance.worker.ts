import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  SUBSCRIPTION_MAINTENANCE_QUEUE,
  SubscriptionMaintenanceJob,
} from '../../notifications/subscription-maintenance.constants';
import { SubscriptionMaintenanceService } from '../../notifications/subscription-maintenance.service';

@Processor(SUBSCRIPTION_MAINTENANCE_QUEUE)
export class SubscriptionMaintenanceWorker extends WorkerHost {
  private readonly logger = new Logger(SubscriptionMaintenanceWorker.name);

  constructor(private readonly maintenance: SubscriptionMaintenanceService) {
    super();
  }

  async process(_job: Job<SubscriptionMaintenanceJob>): Promise<void> {
    this.logger.debug('Running subscription maintenance');
    await this.maintenance.runMaintenance();
  }
}
