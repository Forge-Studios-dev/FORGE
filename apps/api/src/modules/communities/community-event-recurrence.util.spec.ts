import { expandCommunityEvents } from './community-event-recurrence.util';

describe('expandCommunityEvents', () => {
  const base = {
    id: 'evt-1',
    communityId: 'comm-1',
    creatorId: 'creator-1',
    title: 'Office hours',
    description: null,
    location: null,
    isOnline: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  it('returns one occurrence for one_off events', () => {
    const startsAt = new Date('2026-06-01T18:00:00Z');
    const result = expandCommunityEvents(
      [
        {
          ...base,
          startsAt,
          endsAt: null,
          eventType: 'one_off',
          recurrenceRule: null,
          recurrenceUntil: null,
        },
      ],
      { now: new Date('2026-06-01T12:00:00Z') },
    );
    expect(result).toHaveLength(1);
    expect(result[0].seriesEventId).toBe('evt-1');
    expect(result[0].occurrenceStartsAt).toBe(startsAt.toISOString());
  });

  it('expands weekly recurring events', () => {
    const startsAt = new Date('2026-06-01T18:00:00Z');
    const result = expandCommunityEvents(
      [
        {
          ...base,
          startsAt,
          endsAt: null,
          eventType: 'recurring',
          recurrenceRule: 'weekly',
          recurrenceUntil: new Date('2026-06-22T18:00:00Z'),
        },
      ],
      { now: new Date('2026-06-01T12:00:00Z'), horizonDays: 30, maxOccurrences: 10 },
    );
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.every((r) => r.seriesEventId === 'evt-1')).toBe(true);
  });
});
