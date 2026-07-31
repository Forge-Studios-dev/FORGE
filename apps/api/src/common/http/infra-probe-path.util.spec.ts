import { isInfraProbePath } from './infra-probe-path.util';

describe('isInfraProbePath', () => {
  it('matches Fly liveness and readiness probes', () => {
    expect(isInfraProbePath('/api/v1/health/live')).toBe(true);
    expect(isInfraProbePath('/api/v1/health/ready')).toBe(true);
    expect(isInfraProbePath('/api/v1/health')).toBe(true);
    expect(isInfraProbePath('/api/v1/health?x=1')).toBe(true);
  });

  it('matches Prometheus scrape path', () => {
    expect(isInfraProbePath('/metrics')).toBe(true);
    expect(isInfraProbePath('/metrics?foo=1')).toBe(true);
  });

  it('does not match application routes', () => {
    expect(isInfraProbePath('/api/v1/users/me')).toBe(false);
    expect(isInfraProbePath('/api/v1/streams/live')).toBe(false);
    expect(isInfraProbePath('/api/v1/creators/me/streams/x/health')).toBe(false);
    expect(isInfraProbePath(undefined)).toBe(false);
  });
});
