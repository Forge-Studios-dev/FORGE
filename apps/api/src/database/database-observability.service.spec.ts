import { DatabaseObservabilityService } from './database-observability.service';

describe('DatabaseObservabilityService', () => {
  it('returns unavailable when pg_stat_statements extension missing', async () => {
    const dataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    const service = new DatabaseObservabilityService(dataSource as never);
    const result = await service.getTopQueries(10);
    expect(result.available).toBe(false);
    expect(result.stats).toEqual([]);
  });

  it('maps query stats when extension is present', async () => {
    const dataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([
          {
            queryid: '123',
            calls: '10',
            totalExecTimeMs: 100.5,
            meanExecTimeMs: 10.05,
            rows: '20',
            sharedBlksRead: '1',
            sharedBlksHit: '99',
            queryPreview: 'SELECT 1',
          },
        ]),
    };
    const service = new DatabaseObservabilityService(dataSource as never);
    const result = await service.getTopQueries(5);
    expect(result.available).toBe(true);
    expect(result.stats).toHaveLength(1);
    expect(result.stats[0].queryid).toBe('123');
    expect(result.stats[0].calls).toBe(10);
  });
});
