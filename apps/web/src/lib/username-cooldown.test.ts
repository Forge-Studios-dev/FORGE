import { describe, expect, it } from 'vitest';
import {
  formatUsernameUnlockDate,
  isUsernameRenameLocked,
  usernameRenameUnlockAt,
} from './username-cooldown';

describe('usernameRenameUnlockAt', () => {
  it('allows rename when never changed', () => {
    expect(usernameRenameUnlockAt(null)).toBeNull();
    expect(usernameRenameUnlockAt(undefined)).toBeNull();
    expect(isUsernameRenameLocked(null)).toBe(false);
  });

  it('locks until changedAt + 14 days', () => {
    const changedAt = '2026-08-01T12:00:00.000Z';
    const now = Date.parse('2026-08-08T12:00:00.000Z');
    const unlock = usernameRenameUnlockAt(changedAt, now);
    expect(unlock).not.toBeNull();
    expect(formatUsernameUnlockDate(unlock!)).toBe('2026-08-15');
    expect(isUsernameRenameLocked(changedAt, now)).toBe(true);
  });

  it('unlocks after cooldown elapses', () => {
    const changedAt = '2026-07-01T12:00:00.000Z';
    const now = Date.parse('2026-08-08T12:00:00.000Z');
    expect(usernameRenameUnlockAt(changedAt, now)).toBeNull();
    expect(isUsernameRenameLocked(changedAt, now)).toBe(false);
  });
});
