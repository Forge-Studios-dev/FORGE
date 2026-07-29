import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { shouldRegisterBullScheduler } from '../../common/bull/scheduler-role.util';
import {
  STREAM_REMINDER_QUEUE,
  StreamReminderJob,
} from '../workers/stream-reminder/stream-reminder.constants';

const SCHEDULER_ID = 'stream-reminder-scan';
/** Backup scan only — primary path is a delayed job at scheduledAt - 15m. */
const BACKUP_INTERVAL_MS = 30 * 60 * 1000;
const REMINDER_LEAD_MS = 15 * 60_000;

@Injectable()
export class StreamReminderScheduler implements OnModuleInit {
  private readonly logger = new Logger(StreamReminderScheduler.name);

  constructor(
    @InjectQueue(STREAM_REMINDER_QUEUE) private readonly queue: Queue<StreamReminderJob>,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    if (!shouldRegisterBullScheduler()) {
      this.logger.log('Stream reminder scheduler skipped for this process role');
      return;
    }
    void this.registerScheduler();
  }

  /** Event-driven: schedule exactly once at scheduledAt - 15 minutes. */
  async scheduleReminder(streamId: string, scheduledAt: Date): Promise<void> {
    const delay = scheduledAt.getTime() - Date.now() - REMINDER_LEAD_MS;
    const jobId = this.reminderJobId(streamId);
    try {
      const existing = await this.queue.getJob(jobId);
      if (existing) await existing.remove();
      if (delay <= 0) {
        // Already inside the 15m window — enqueue immediately for the worker scan path.
        await this.queue.add('remind', { streamId }, { jobId, removeOnComplete: true });
        return;
      }
      await this.queue.add(
        'remind',
        { streamId },
        {
          jobId,
          delay,
          attempts: 2,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch (err) {
      this.logger.warn(
        `Stream reminder schedule failed for ${streamId}: ${(err as Error).message}`,
      );
    }
  }

  async cancelReminder(streamId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(this.reminderJobId(streamId));
      if (job) await job.remove();
    } catch {
      // non-fatal
    }
  }

  private reminderJobId(streamId: string): string {
    return `stream-reminder:${streamId}`;
  }

  private async registerScheduler(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        SCHEDULER_ID,
        { every: BACKUP_INTERVAL_MS },
        {
          name: 'scan',
          data: {},
          opts: { removeOnComplete: { age: 3600, count: 100 } },
        },
      );
      this.logger.log(
        'Stream reminder backup scheduler registered (every 30m — primary is delayed jobs)',
      );
    } catch (err) {
      this.logger.warn(`Stream reminder scheduler failed: ${(err as Error).message}`);
    }
  }
}
