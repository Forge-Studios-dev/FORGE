import { viewCountThresholdSeconds } from './videos.service';

describe('viewCountThresholdSeconds', () => {
  it('uses 30s default when duration unknown', () => {
    expect(viewCountThresholdSeconds(null)).toBe(30);
  });

  it('uses 30% for short videos (min 3s)', () => {
    expect(viewCountThresholdSeconds(10)).toBe(3);
  });

  it('caps at 30s for long videos', () => {
    expect(viewCountThresholdSeconds(600)).toBe(30);
  });
});
