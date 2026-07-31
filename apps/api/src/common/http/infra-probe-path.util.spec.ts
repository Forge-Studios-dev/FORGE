import { isInfraProbePath } from './infra-probe-path.util';

describe('isInfraProbePath', () => {
  it('matches Fly liveness and Prometheus scrape', () => {
    expect(isInfraProbePath('/api/v1/health/live')).toBe(true);
    expect(isInfraProbePath('/api/v1/health/live?region=bom')).toBe(true);
    expect(isInfraProbePath('/metrics')).toBe(true);
    expect(isInfraProbePath('/metrics?foo=1')).toBe(true);
  });

  it('does not silence readiness (keep abuse visible in logs/metrics)', () => {
    expect(isInfraProbePath('/api/v1/health')).toBe(false);
    expect(isInfraProbePath('/api/v1/health?x=1')).toBe(false);
    expect(isInfraProbePath('/api/v1/health/ready')).toBe(false);
  });

  it('does not match near-miss or application routes', () => {
    expect(isInfraProbePath('/api/v1/users/me')).toBe(false);
    expect(isInfraProbePath('/api/v1/streams/live')).toBe(false);
    expect(isInfraProbePath('/api/v1/creators/me/streams/x/health')).toBe(false);
    expect(isInfraProbePath('/api/v1/health/live-preview')).toBe(false);
    expect(isInfraProbePath('/api/v1/health/live/extra')).toBe(false);
    expect(isInfraProbePath('/redirect?next=/api/v1/health/live')).toBe(false);
    expect(isInfraProbePath(undefined)).toBe(false);
  });
});
