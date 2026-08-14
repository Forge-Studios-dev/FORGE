import {
  actorIdsFromNotificationMetadata,
  notificationInvolvesBlockedPeer,
} from './notification-actor.util';

describe('notification-actor.util', () => {
  it('extracts known actor metadata keys', () => {
    expect(
      actorIdsFromNotificationMetadata({
        followerId: 'a',
        creatorId: 'b',
        unrelated: 'x',
      }),
    ).toEqual(['b', 'a']);
  });

  it('detects blocked peer involvement', () => {
    const blocked = new Set(['blocked-1']);
    expect(notificationInvolvesBlockedPeer({ likerId: 'blocked-1' }, blocked)).toBe(true);
    expect(notificationInvolvesBlockedPeer({ likerId: 'ok' }, blocked)).toBe(false);
    expect(notificationInvolvesBlockedPeer(null, blocked)).toBe(false);
  });
});
