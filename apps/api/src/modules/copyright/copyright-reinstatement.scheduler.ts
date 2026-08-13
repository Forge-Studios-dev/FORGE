import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { shouldRegisterBullScheduler } from '../../common/bull/scheduler-role.util';
import { COPYRIGHT_REINSTATEMENT_QUEUE } from './copyright-reinstatement.constants';

const SCHEDULER_ID = 'copyright-reinstatement-scan';
const SCAN_INTERVAL_MS = 60 * 60 * 1000; // hourly — a few hours' slack against a 10-business-day window is fine
const REGISTER_TIMEOUT_MS = 10_000;

function shouldRegisterScheduler(): boolean {
  return shouldRegisterBullScheduler('DISABLE_COPYRIGHT_REINSTATEMENT');
}

@Injectable()
export class CopyrightReinstatementScheduler implements OnModuleInit {
  private readonly logger = new Logger(CopyrightReinstatementScheduler.name);

  constructor(@InjectQueue(COPYRIGHT_REINSTATEMENT_QUEUE) private readonly queue: Queue) {}

  onModuleInit() {
    if (!shouldRegisterScheduler()) {
      this.logger.log('Copyright reinstatement scanner skipped for this process role');
      return;
    }
    void this.registerScheduler();
  }

  private async registerScheduler(): Promise<void> {
    try {
      await Promise.race([
        this.queue.upsertJobScheduler(
          SCHEDULER_ID,
          { every: SCAN_INTERVAL_MS },
          {
            name: 'run',
            data: {},
            opts: {
              removeOnComplete: { age: 7 * 86400, count: 50 },
              removeOnFail: { age: 7 * 86400, count: 50 },
            },
          },
        ),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`scheduler registration timed out after ${REGISTER_TIMEOUT_MS}ms`)),
            REGISTER_TIMEOUT_MS,
          ),
        ),
      ]);
      this.logger.log('Copyright reinstatement repeatable job registered (hourly)');
    } catch (err) {
      this.logger.warn(
        `Could not register copyright reinstatement scanner: ${(err as Error).message}`,
      );
    }
  }
}
