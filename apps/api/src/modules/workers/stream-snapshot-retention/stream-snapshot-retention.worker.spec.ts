import { Job } from 'bullmq';
import { StreamSnapshotRetentionWorker } from './stream-snapshot-retention.worker';

describe('StreamSnapshotRetentionWorker', () => {
  let worker: StreamSnapshotRetentionWorker;
  const snapshotRepository = { delete: jest.fn().mockResolvedValue({ affected: 3 }) };
  const configValues: Record<string, unknown> = {};
  const configService = { get: jest.fn((k: string) => configValues[k]) };

  const job = {} as Job;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(configValues)) delete configValues[k];
    worker = new StreamSnapshotRetentionWorker(snapshotRepository as never, configService as never);
  });

  it('deletes snapshots older than the configured retention window', async () => {
    configValues['stream.snapshotRetentionDays'] = 30;
    await worker.process(job);
    expect(snapshotRepository.delete).toHaveBeenCalledWith({ recordedAt: expect.any(Object) });
    const arg = snapshotRepository.delete.mock.calls[0][0].recordedAt;
    expect(arg.type).toBe('lessThan');
    expect(arg.value).toBeInstanceOf(Date);
  });

  it('defaults to a 90-day window when unconfigured', async () => {
    await worker.process(job);
    expect(snapshotRepository.delete).toHaveBeenCalled();
  });

  it('disables retention (no deletes) when configured to 0 days', async () => {
    configValues['stream.snapshotRetentionDays'] = 0;
    await worker.process(job);
    expect(snapshotRepository.delete).not.toHaveBeenCalled();
  });
});
