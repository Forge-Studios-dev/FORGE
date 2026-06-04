import { Gauge } from 'prom-client';
import type { Queue } from 'bullmq';
import { forgeMetricsEnabled, getForgeMetricsRegistry } from './forge-metrics';

type JobCounts = {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
};

let jobsWaiting: Gauge<'queue'> | null = null;
let jobsActive: Gauge<'queue'> | null = null;
let jobsDelayed: Gauge<'queue'> | null = null;
let jobsFailed: Gauge<'queue'> | null = null;

function ensureBullmqGauges(): void {
  if (jobsWaiting) return;
  const register = getForgeMetricsRegistry();
  jobsWaiting = new Gauge({
    name: 'forge_bullmq_jobs_waiting',
    help: 'BullMQ jobs in waiting state',
    labelNames: ['queue'] as const,
    registers: [register],
  });
  jobsActive = new Gauge({
    name: 'forge_bullmq_jobs_active',
    help: 'BullMQ jobs in active state',
    labelNames: ['queue'] as const,
    registers: [register],
  });
  jobsDelayed = new Gauge({
    name: 'forge_bullmq_jobs_delayed',
    help: 'BullMQ jobs in delayed state',
    labelNames: ['queue'] as const,
    registers: [register],
  });
  jobsFailed = new Gauge({
    name: 'forge_bullmq_jobs_failed',
    help: 'BullMQ jobs in failed state',
    labelNames: ['queue'] as const,
    registers: [register],
  });
}

export function recordBullmqJobCounts(queueName: string, counts: JobCounts): void {
  if (!forgeMetricsEnabled()) return;
  ensureBullmqGauges();
  const labels = { queue: queueName };
  jobsWaiting!.set(labels, counts.waiting);
  jobsActive!.set(labels, counts.active);
  jobsDelayed!.set(labels, counts.delayed);
  jobsFailed!.set(labels, counts.failed);
}

/** Refresh Prometheus gauges for all registered BullMQ queues (F-903). */
export async function refreshBullmqMetrics(queues: Array<{ name: string; queue: Queue }>): Promise<void> {
  if (!forgeMetricsEnabled() || queues.length === 0) return;
  await Promise.all(
    queues.map(async ({ name, queue }) => {
      try {
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
        recordBullmqJobCounts(name, {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
        });
      } catch {
        /* Redis unavailable during scrape — skip this queue */
      }
    }),
  );
}
