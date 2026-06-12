import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { shouldRegisterBullScheduler } from '../../common/bull/scheduler-role.util';
import { STREAM_MUX_SYNC_QUEUE } from '../workers/stream-mux-sync/stream-mux-sync.constants';

export const MUX_SYNC_SCHEDULER_ID = 'stream-mux-sync-scan';
export const MUX_SYNC_INTERVAL_LIVE_MS = 45_000;
export const MUX_SYNC_INTERVAL_IDLE_MS = 90_000;
export const MUX_SYNC_INTERVAL_DORMANT_MS = Number(
  process.env.MUX_SYNC_INTERVAL_DORMANT_MS ?? 900_000,
);

@Injectable()
export class StreamMuxSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(StreamMuxSyncScheduler.name);
  private currentIntervalMs = MUX_SYNC_INTERVAL_IDLE_MS;

  constructor(@InjectQueue(STREAM_MUX_SYNC_QUEUE) private readonly queue: Queue) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    if (!shouldRegisterBullScheduler()) {
      this.logger.log('Stream Mux sync scheduler skipped for this process role');
      return;
    }
    void this.registerScheduler(MUX_SYNC_INTERVAL_IDLE_MS);
  }

  /** Adjust scan frequency: 45s live / 90s idle / 15m dormant (deep idle). */
  async syncIntervalForActivity(opts: {
    hasLiveStreams: boolean;
    isDormant: boolean;
  }): Promise<void> {
    let target = MUX_SYNC_INTERVAL_IDLE_MS;
    if (opts.isDormant) {
      target = MUX_SYNC_INTERVAL_DORMANT_MS;
    } else if (opts.hasLiveStreams) {
      target = MUX_SYNC_INTERVAL_LIVE_MS;
    }
    if (target === this.currentIntervalMs) return;
    await this.registerScheduler(target);
  }

  /** @deprecated Use syncIntervalForActivity */
  async syncIntervalForLiveActivity(hasLiveStreams: boolean): Promise<void> {
    return this.syncIntervalForActivity({ hasLiveStreams, isDormant: false });
  }

  private async registerScheduler(everyMs: number): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        MUX_SYNC_SCHEDULER_ID,
        { every: everyMs },
        {
          name: 'scan',
          data: {},
          opts: { removeOnComplete: { age: 3600, count: 200 } },
        },
      );
      this.currentIntervalMs = everyMs;
      this.logger.log(`Stream Mux sync scheduler registered (every ${everyMs / 1000}s)`);
    } catch (err) {
      this.logger.warn(`Stream Mux sync scheduler failed: ${(err as Error).message}`);
    }
  }
}
