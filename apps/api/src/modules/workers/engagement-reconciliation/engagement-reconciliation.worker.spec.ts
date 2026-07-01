import { Job } from 'bullmq';
import { EngagementReconciliationWorker } from './engagement-reconciliation.worker';
import { EngagementReconciliationJob } from '../../engagement/engagement-reconciliation.constants';

describe('EngagementReconciliationWorker', () => {
  let worker: EngagementReconciliationWorker;
  const reconciliation = { reconcileAll: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new EngagementReconciliationWorker(reconciliation as never);
  });

  it('reconciles all engagement counters on schedule', async () => {
    await worker.process({ data: {} } as Job<EngagementReconciliationJob>);
    expect(reconciliation.reconcileAll).toHaveBeenCalledTimes(1);
  });

  it('propagates failures so BullMQ retries', async () => {
    reconciliation.reconcileAll.mockRejectedValueOnce(new Error('reconcile failed'));
    await expect(
      worker.process({ data: {} } as Job<EngagementReconciliationJob>),
    ).rejects.toThrow('reconcile failed');
  });
});
