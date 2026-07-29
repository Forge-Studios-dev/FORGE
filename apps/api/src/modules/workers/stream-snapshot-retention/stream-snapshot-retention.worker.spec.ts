import { Job } from 'bullmq';
import { StreamSnapshotRetentionWorker } from './stream-snapshot-retention.worker';

describe('StreamSnapshotRetentionWorker', () => {
  let worker: StreamSnapshotRetentionWorker;
  const execute = jest.fn().mockResolvedValue({ affected: 3 });
  const setParameters = jest.fn().mockReturnThis();
  const deleteQb = {
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setParameters,
    execute,
  };
  const idQb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getQuery: jest.fn().mockReturnValue('SELECT s.id FROM stream_analytics_snapshots s'),
    getParameters: jest.fn().mockReturnValue({ cutoff: expect.any(Date) }),
  };
  const snapshotRepository = {
    createQueryBuilder: jest.fn((alias?: string) => (alias ? idQb : deleteQb)),
  };
  const configValues: Record<string, unknown> = {};
  const configService = { get: jest.fn((k: string) => configValues[k]) };

  const job = {} as Job;

  beforeEach(() => {
    jest.clearAllMocks();
    execute.mockResolvedValue({ affected: 3 });
    // Second pass returns 0 so the loop stops.
    execute.mockResolvedValueOnce({ affected: 3 }).mockResolvedValueOnce({ affected: 0 });
    idQb.getParameters.mockReturnValue({ cutoff: new Date() });
    for (const k of Object.keys(configValues)) delete configValues[k];
    worker = new StreamSnapshotRetentionWorker(snapshotRepository as never, configService as never);
  });

  it('deletes snapshots older than the configured retention window', async () => {
    configValues['stream.snapshotRetentionDays'] = 30;
    await worker.process(job);
    expect(snapshotRepository.createQueryBuilder).toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();
    const whereCutoff = idQb.where.mock.calls[0]?.[1]?.cutoff;
    expect(whereCutoff).toBeInstanceOf(Date);
  });

  it('defaults to a 90-day window when unconfigured', async () => {
    await worker.process(job);
    expect(execute).toHaveBeenCalled();
  });

  it('disables retention (no deletes) when configured to 0 days', async () => {
    configValues['stream.snapshotRetentionDays'] = 0;
    await worker.process(job);
    expect(snapshotRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
