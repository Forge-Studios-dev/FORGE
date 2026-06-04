import { Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { VIDEO_PROCESSING_QUEUE } from '../../modules/content/videos.service';
import { MUX_VOD_INGEST_QUEUE } from '../../modules/content/mux-vod.constants';
import { ANALYTICS_INGEST_QUEUE } from '../../modules/analytics/analytics-ingest.constants';
import { PUSH_DISPATCH_QUEUE } from '../../modules/notifications/push-dispatch.constants';
import { SUBSCRIPTION_MAINTENANCE_QUEUE } from '../../modules/notifications/subscription-maintenance.constants';
import { refreshBullmqMetrics } from './bullmq-metrics';

@Injectable()
export class BullmqMetricsService {
  constructor(
    @InjectQueue(ANALYTICS_INGEST_QUEUE) private readonly analyticsQueue: Queue,
    @InjectQueue(PUSH_DISPATCH_QUEUE) private readonly pushQueue: Queue,
    @InjectQueue(SUBSCRIPTION_MAINTENANCE_QUEUE) private readonly subscriptionQueue: Queue,
    @Optional() @InjectQueue(VIDEO_PROCESSING_QUEUE) private readonly videoQueue?: Queue,
    @Optional() @InjectQueue(MUX_VOD_INGEST_QUEUE) private readonly muxVodQueue?: Queue,
  ) {}

  async refresh(): Promise<void> {
    const queues: Array<{ name: string; queue: Queue }> = [];
    if (this.videoQueue) queues.push({ name: VIDEO_PROCESSING_QUEUE, queue: this.videoQueue });
    if (this.muxVodQueue) queues.push({ name: MUX_VOD_INGEST_QUEUE, queue: this.muxVodQueue });
    queues.push(
      { name: ANALYTICS_INGEST_QUEUE, queue: this.analyticsQueue },
      { name: PUSH_DISPATCH_QUEUE, queue: this.pushQueue },
      { name: SUBSCRIPTION_MAINTENANCE_QUEUE, queue: this.subscriptionQueue },
    );
    await refreshBullmqMetrics(queues);
  }
}
