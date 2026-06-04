import { AnalyticsRetentionService } from './analytics-retention.service';

describe('AnalyticsRetentionService', () => {
  const repo = {} as never;
  let service: AnalyticsRetentionService;

  beforeEach(() => {
    delete process.env.DISABLE_ANALYTICS_RETENTION;
    delete process.env.ANALYTICS_RETENTION_DAYS;
    service = new AnalyticsRetentionService(repo);
  });

  it('skips when retention days is 0', async () => {
    process.env.ANALYTICS_RETENTION_DAYS = '0';
    const spy = jest.spyOn(service as never as { deleteBatch: () => Promise<number> }, 'deleteBatch');
    await service.runRetention();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('deletes batches until empty', async () => {
    const deleteBatch = jest
      .spyOn(service as never as { deleteBatch: (c: Date, n: number) => Promise<number> }, 'deleteBatch')
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(0);

    await service.runRetention();

    expect(deleteBatch).toHaveBeenCalledTimes(3);
    deleteBatch.mockRestore();
  });
});
