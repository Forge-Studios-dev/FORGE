import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { MetricsController } from './metrics.controller';

describe('MetricsController', () => {
  const controller = new MetricsController();
  const res = { setHeader: jest.fn() } as unknown as import('express').Response;

  const originalEnabled = process.env.METRICS_ENABLED;
  const originalToken = process.env.METRICS_SCRAPE_TOKEN;

  afterEach(() => {
    process.env.METRICS_ENABLED = originalEnabled;
    process.env.METRICS_SCRAPE_TOKEN = originalToken;
  });

  it('returns 404 when metrics disabled', async () => {
    process.env.METRICS_ENABLED = 'false';
    delete process.env.METRICS_SCRAPE_TOKEN;
    await expect(
      controller.metrics({ headers: {} } as import('express').Request, res),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows scrape without token when METRICS_SCRAPE_TOKEN unset', async () => {
    process.env.METRICS_ENABLED = 'true';
    delete process.env.METRICS_SCRAPE_TOKEN;
    const body = await controller.metrics(
      { headers: {} } as import('express').Request,
      res,
    );
    expect(body).toContain('forge_http_requests_total');
  });

  it('requires bearer token when METRICS_SCRAPE_TOKEN is set', async () => {
    process.env.METRICS_ENABLED = 'true';
    process.env.METRICS_SCRAPE_TOKEN = 'secret-scrape';
    await expect(
      controller.metrics({ headers: {} } as import('express').Request, res),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const body = await controller.metrics(
      {
        headers: { authorization: 'Bearer secret-scrape' },
      } as import('express').Request,
      res,
    );
    expect(body).toContain('forge_http_requests_total');
  });
});
