import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SUBSCRIPTION_MAINTENANCE_QUEUE } from './subscription-maintenance.constants';

const SCHEDULER_ID = 'subscription-maintenance-hourly';
const HOURLY_MS = 60 * 60 * 1000;

@Injectable()
export class SubscriptionMaintenanceScheduler implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionMaintenanceScheduler.name);

  constructor(
    @InjectQueue(SUBSCRIPTION_MAINTENANCE_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    if (process.env.DISABLE_SUBSCRIPTION_MAINTENANCE === 'true') {
      this.logger.log('Subscription maintenance scheduler disabled');
      return;
    }

    try {
      await this.queue.upsertJobScheduler(
        SCHEDULER_ID,
        { every: HOURLY_MS },
        {
          name: 'run',
          data: {},
          opts: {
            removeOnComplete: { age: 86400, count: 48 },
            removeOnFail: { age: 7 * 86400, count: 100 },
          },
        },
      );
      this.logger.log('Subscription maintenance repeatable job registered (hourly)');
    } catch (err) {
      this.logger.warn(
        `Could not register subscription maintenance scheduler: ${(err as Error).message}`,
      );
    }
  }
}
