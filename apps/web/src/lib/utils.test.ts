import { describe, expect, it } from 'vitest';
import { formatCentsCurrency, formatCentsUsd } from './utils';

describe('formatCentsUsd / formatCentsCurrency', () => {
  it('formats USD whole units', () => {
    expect(formatCentsUsd(12345)).toMatch(/123/);
    expect(formatCentsUsd(0)).toMatch(/0/);
  });

  it('honors explicit currency codes', () => {
    const inr = formatCentsCurrency(99900, 'INR');
    expect(inr).toMatch(/999/);
    expect(formatCentsCurrency(9900, 'usd')).toBe(formatCentsUsd(9900));
  });

  it('falls back to USD on invalid currency', () => {
    expect(formatCentsCurrency(500, 'NOTACURRENCY')).toBe(formatCentsUsd(500));
  });
});
