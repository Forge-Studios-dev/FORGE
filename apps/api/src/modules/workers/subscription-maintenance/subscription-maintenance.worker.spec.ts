import { Job } from 'bullmq';
import { SubscriptionMaintenanceWorker } from './subscription-maintenance.worker';
import { SubscriptionMaintenanceJob } from '../../notifications/subscription-maintenance.constants';

describe('SubscriptionMaintenanceWorker', () => {
  let worker: SubscriptionMaintenanceWorker;
  const maintenance = { runMaintenance: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new SubscriptionMaintenanceWorker(maintenance as never);
  });

  it('runs subscription maintenance for each scheduled job', async () => {
    await worker.process({ data: {} } as Job<SubscriptionMaintenanceJob>);
    expect(maintenance.runMaintenance).toHaveBeenCalledTimes(1);
  });

  it('propagates failures so BullMQ retries', async () => {
    maintenance.runMaintenance.mockRejectedValueOnce(new Error('db unavailable'));
    await expect(
      worker.process({ data: {} } as Job<SubscriptionMaintenanceJob>),
    ).rejects.toThrow('db unavailable');
  });
});
