import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { shouldRegisterBullScheduler } from '../../common/bull/scheduler-role.util';
import { STREAM_MUX_SYNC_QUEUE } from '../workers/stream-mux-sync/stream-mux-sync.constants';

export const MUX_SYNC_SCHEDULER_ID = 'stream-mux-sync-scan';

/**
 * Webhook-first model:
 * - Mux pushes `video.live_stream.active|idle` → API → Socket.IO to clients.
 * - Reconnect grace uses a delayed Bull job (not a tight poll loop).
 * - This scheduler is only a slow Mux REST backup for missed webhooks.
 */
export const MUX_SYNC_INTERVAL_LIVE_MS = Number(
  process.env.MUX_SYNC_INTERVAL_LIVE_MS ?? 300_000,
); // 5m backup while anything is live
export const MUX_SYNC_INTERVAL_IDLE_MS = Number(
  process.env.MUX_SYNC_INTERVAL_IDLE_MS ?? 300_000,
); // 5m backup for soon-to-go-live rooms
export const MUX_SYNC_INTERVAL_DORMANT_MS = Number(
  process.env.MUX_SYNC_INTERVAL_DORMANT_MS ?? 900_000,
); // 15m deep idle

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

  /** Adjust backup scan frequency: 5m live/idle / 15m dormant. */
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
      this.logger.log(
        `Stream Mux backup sync scheduler registered (every ${everyMs / 1000}s — webhook-first)`,
      );
    } catch (err) {
      this.logger.warn(`Stream Mux sync scheduler failed: ${(err as Error).message}`);
    }
  }
}
