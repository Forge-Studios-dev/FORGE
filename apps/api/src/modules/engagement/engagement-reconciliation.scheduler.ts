import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { shouldRegisterBullScheduler } from '../../common/bull/scheduler-role.util';
import { ENGAGEMENT_RECONCILIATION_QUEUE } from './engagement-reconciliation.constants';

const SCHEDULER_ID = 'engagement-reconciliation-daily';
const DAILY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class EngagementReconciliationScheduler implements OnModuleInit {
  private readonly logger = new Logger(EngagementReconciliationScheduler.name);

  constructor(
    @InjectQueue(ENGAGEMENT_RECONCILIATION_QUEUE)
    private readonly queue: Queue,
  ) {}

  onModuleInit() {
    if (!shouldRegisterBullScheduler('DISABLE_ENGAGEMENT_RECONCILIATION')) {
      this.logger.log('Engagement reconciliation scheduler skipped for this process role');
      return;
    }
    void this.registerScheduler();
  }

  private async registerScheduler(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        SCHEDULER_ID,
        { every: DAILY_MS },
        {
          name: 'run',
          data: {},
          opts: {
            removeOnComplete: { age: 7 * 86400, count: 14 },
            removeOnFail: { age: 7 * 86400, count: 50 },
          },
        },
      );
      this.logger.log('Engagement reconciliation repeatable job registered (daily)');
    } catch (err) {
      this.logger.warn(
        `Could not register engagement reconciliation scheduler: ${(err as Error).message}`,
      );
    }
  }
}
