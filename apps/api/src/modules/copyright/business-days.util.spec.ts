import { addBusinessDays } from './business-days.util';

describe('addBusinessDays', () => {
  it('skips weekends when adding business days', () => {
    // Monday 2026-08-10 + 5 business days = following Monday 2026-08-17.
    const monday = new Date('2026-08-10T12:00:00Z');
    const result = addBusinessDays(monday, 5);
    expect(result.toISOString().slice(0, 10)).toBe('2026-08-17');
  });

  it('adds 10 business days spanning two weekends', () => {
    // Monday 2026-08-10 + 10 business days = Monday 2026-08-24.
    const monday = new Date('2026-08-10T12:00:00Z');
    const result = addBusinessDays(monday, 10);
    expect(result.toISOString().slice(0, 10)).toBe('2026-08-24');
  });

  it('starting on a Friday, +1 business day lands on Monday', () => {
    const friday = new Date('2026-08-14T12:00:00Z');
    const result = addBusinessDays(friday, 1);
    expect(result.toISOString().slice(0, 10)).toBe('2026-08-17');
  });
});
