import { Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { VIDEO_PROCESSING_QUEUE } from '../../modules/content/video-processing.constants';
import { MUX_VOD_INGEST_QUEUE } from '../../modules/content/mux-vod.constants';
import { ANALYTICS_INGEST_QUEUE } from '../../modules/analytics/analytics-ingest.constants';
import { PUSH_DISPATCH_QUEUE } from '../../modules/notifications/push-dispatch.constants';
import { SUBSCRIPTION_MAINTENANCE_QUEUE } from '../../modules/notifications/subscription-maintenance.constants';
import { ANALYTICS_RETENTION_QUEUE } from '../../modules/analytics/analytics-retention.constants';
import { refreshBullmqMetrics } from './bullmq-metrics';

/** Avoid Redis getJobCounts on every Prometheus scrape (Grafana often polls every 15–60s). */
const REFRESH_CACHE_MS = 30_000;

@Injectable()
export class BullmqMetricsService {
  private lastRefreshAt = 0;

  constructor(
    @InjectQueue(ANALYTICS_INGEST_QUEUE) private readonly analyticsQueue: Queue,
    @InjectQueue(PUSH_DISPATCH_QUEUE) private readonly pushQueue: Queue,
    @InjectQueue(SUBSCRIPTION_MAINTENANCE_QUEUE) private readonly subscriptionQueue: Queue,
    @InjectQueue(ANALYTICS_RETENTION_QUEUE) private readonly analyticsRetentionQueue: Queue,
    @Optional() @InjectQueue(VIDEO_PROCESSING_QUEUE) private readonly videoQueue?: Queue,
    @Optional() @InjectQueue(MUX_VOD_INGEST_QUEUE) private readonly muxVodQueue?: Queue,
  ) {}

  async refresh(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRefreshAt < REFRESH_CACHE_MS) return;
    this.lastRefreshAt = now;

    const queues: Array<{ name: string; queue: Queue }> = [];
    if (this.videoQueue) queues.push({ name: VIDEO_PROCESSING_QUEUE, queue: this.videoQueue });
    if (this.muxVodQueue) queues.push({ name: MUX_VOD_INGEST_QUEUE, queue: this.muxVodQueue });
    queues.push(
      { name: ANALYTICS_INGEST_QUEUE, queue: this.analyticsQueue },
      { name: PUSH_DISPATCH_QUEUE, queue: this.pushQueue },
      { name: SUBSCRIPTION_MAINTENANCE_QUEUE, queue: this.subscriptionQueue },
      { name: ANALYTICS_RETENTION_QUEUE, queue: this.analyticsRetentionQueue },
    );
    await refreshBullmqMetrics(queues);
  }
}
