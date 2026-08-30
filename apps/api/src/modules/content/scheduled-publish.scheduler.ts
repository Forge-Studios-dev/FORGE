import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { shouldRegisterBullScheduler } from '../../common/bull/scheduler-role.util';
import { SCHEDULED_PUBLISH_QUEUE, ScheduledPublishJob } from './scheduled-publish.constants';

const SCHEDULER_ID = 'scheduled-publish-scan';
/** Backup scan only — primary path is a delayed job at scheduledPublishAt. */
export const SCHEDULED_PUBLISH_BACKUP_INTERVAL_MS = 15 * 60 * 1000;
const REGISTER_TIMEOUT_MS = 10_000;

function shouldRegisterScheduler(): boolean {
  return shouldRegisterBullScheduler('DISABLE_SCHEDULED_PUBLISH');
}

@Injectable()
export class ScheduledPublishScheduler implements OnModuleInit {
  private readonly logger = new Logger(ScheduledPublishScheduler.name);

  constructor(
    @InjectQueue(SCHEDULED_PUBLISH_QUEUE)
    private readonly queue: Queue<ScheduledPublishJob>,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    if (!shouldRegisterScheduler()) {
      this.logger.log('Scheduled publish scanner skipped for this process role');
      return;
    }
    void this.registerScheduler();
  }

  /** Event-driven: fire once at scheduledPublishAt (backup scan catches misses). */
  async schedulePublish(videoId: string, scheduledAt: Date): Promise<void> {
    const delay = scheduledAt.getTime() - Date.now();
    const jobId = this.publishJobId(videoId);
    try {
      const existing = await this.queue.getJob(jobId);
      if (existing) await existing.remove();
      await this.queue.add(
        'publish',
        { videoId },
        {
          jobId,
          delay: Math.max(0, delay),
          attempts: 2,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch (err) {
      this.logger.warn(
        `Scheduled publish enqueue failed for ${videoId}: ${(err as Error).message}`,
      );
    }
  }

  async cancelPublish(videoId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(this.publishJobId(videoId));
      if (job) await job.remove();
    } catch {
      // non-fatal
    }
  }

  private publishJobId(videoId: string): string {
    return `scheduled-publish:${videoId}`;
  }

  private async registerScheduler(): Promise<void> {
    try {
      await Promise.race([
        this.queue.upsertJobScheduler(
          SCHEDULER_ID,
          { every: SCHEDULED_PUBLISH_BACKUP_INTERVAL_MS },
          {
            name: 'run',
            data: {},
            opts: {
              removeOnComplete: { age: 3600, count: 50 },
              removeOnFail: { age: 3600, count: 50 },
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
      this.logger.log(
        'Scheduled publish backup scheduler registered (every 15m — primary is delayed jobs)',
      );
    } catch (err) {
      this.logger.warn(`Could not register scheduled publish scanner: ${(err as Error).message}`);
    }
  }
}