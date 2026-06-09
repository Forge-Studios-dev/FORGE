import { shouldRegisterBullScheduler } from './scheduler-role.util';

describe('shouldRegisterBullScheduler', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.WORKER_ONLY;
    delete process.env.NODE_ENV;
    delete process.env.DISABLE_ANALYTICS_RETENTION;
  });

  afterAll(() => {
    process.env = env;
  });

  it('registers on worker in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.WORKER_ONLY = 'true';
    expect(shouldRegisterBullScheduler()).toBe(true);
  });

  it('skips on API in production', () => {
    process.env.NODE_ENV = 'production';
    expect(shouldRegisterBullScheduler()).toBe(false);
  });

  it('registers on dev API', () => {
    process.env.NODE_ENV = 'development';
    expect(shouldRegisterBullScheduler()).toBe(true);
  });

  it('respects disable env key', () => {
    process.env.DISABLE_ANALYTICS_RETENTION = 'true';
    expect(shouldRegisterBullScheduler('DISABLE_ANALYTICS_RETENTION')).toBe(false);
  });
});
