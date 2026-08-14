import { Job } from 'bullmq';
import { CopyrightReinstatementWorker } from './copyright-reinstatement.worker';
import { CopyrightReinstatementJob } from '../../copyright/copyright-reinstatement.constants';

describe('CopyrightReinstatementWorker', () => {
  let worker: CopyrightReinstatementWorker;
  const copyrightService = { runDueReinstatements: jest.fn().mockResolvedValue({ reinstated: 0 }) };

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new CopyrightReinstatementWorker(copyrightService as never);
  });

  it('runs the reinstatement scan', async () => {
    await worker.process({ data: {} } as Job<CopyrightReinstatementJob>);
    expect(copyrightService.runDueReinstatements).toHaveBeenCalledTimes(1);
  });

  it('propagates failures so BullMQ retries', async () => {
    copyrightService.runDueReinstatements.mockRejectedValueOnce(new Error('scan failed'));
    await expect(
      worker.process({ data: {} } as Job<CopyrightReinstatementJob>),
    ).rejects.toThrow('scan failed');
  });
});
