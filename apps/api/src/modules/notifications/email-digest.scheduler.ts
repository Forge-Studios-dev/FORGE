import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { shouldRegisterBullScheduler } from '../../common/bull/scheduler-role.util';
import { EMAIL_DIGEST_QUEUE } from './email-digest.constants';

const SCHEDULER_ID = 'email-digest-daily';
/** 13:00 UTC — mid-morning across US timezones, evening in most of Asia/Europe. */
const DAILY_CRON = '0 13 * * *';
const REGISTER_TIMEOUT_MS = 10_000;

function shouldRegisterScheduler(): boolean {
  return shouldRegisterBullScheduler('DISABLE_EMAIL_DIGEST');
}

@Injectable()
export class EmailDigestScheduler implements OnModuleInit {
  private readonly logger = new Logger(EmailDigestScheduler.name);

  constructor(
    @InjectQueue(EMAIL_DIGEST_QUEUE)
    private readonly queue: Queue,
  ) {}

  onModuleInit() {
    if (!shouldRegisterScheduler()) {
      this.logger.log('Email digest scheduler skipped for this process role');
      return;
    }
    void this.registerScheduler();
  }

  private async registerScheduler(): Promise<void> {
    try {
      await Promise.race([
        this.queue.upsertJobScheduler(
          SCHEDULER_ID,
          { pattern: DAILY_CRON, tz: 'UTC' },
          {
            name: 'run',
            data: {},
            opts: {
              removeOnComplete: { age: 7 * 86400, count: 30 },
              removeOnFail: { age: 30 * 86400, count: 100 },
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
      this.logger.log('Email digest repeatable job registered (daily, 13:00 UTC)');
    } catch (err) {
      this.logger.warn(`Could not register email digest scheduler: ${(err as Error).message}`);
    }
  }
}
