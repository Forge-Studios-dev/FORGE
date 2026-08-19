export type CommunityRecurrenceRule = 'weekly' | 'biweekly' | 'monthly';

export type EventSeriesInput = {
  id: string;
  communityId: string;
  creatorId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  isOnline: boolean;
  eventType: string;
  recurrenceRule: string | null;
  recurrenceUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ExpandedCommunityEvent = EventSeriesInput & {
  seriesEventId: string;
  occurrenceStartsAt: string;
  occurrenceEndsAt: string | null;
  isRecurrenceInstance: boolean;
};

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function advanceCursor(cursor: Date, rule: CommunityRecurrenceRule): Date {
  const next = new Date(cursor);
  if (rule === 'weekly') {
    next.setDate(next.getDate() + 7);
    return next;
  }
  if (rule === 'biweekly') {
    next.setDate(next.getDate() + 14);
    return next;
  }
  return addMonths(next, 1);
}

export function expandCommunityEvents(
  events: EventSeriesInput[],
  options?: { horizonDays?: number; maxOccurrences?: number; now?: Date },
): ExpandedCommunityEvent[] {
  const horizonDays = options?.horizonDays ?? 90;
  const maxOccurrences = options?.maxOccurrences ?? 50;
  const now = options?.now ?? new Date();
  const horizonEnd = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const expanded: ExpandedCommunityEvent[] = [];

  for (const event of events) {
    const durationMs =
      event.endsAt && event.startsAt ? event.endsAt.getTime() - event.startsAt.getTime() : 0;

    if (event.eventType !== 'recurring' || !event.recurrenceRule) {
      expanded.push({
        ...event,
        seriesEventId: event.id,
        occurrenceStartsAt: event.startsAt.toISOString(),
        occurrenceEndsAt: event.endsAt?.toISOString() ?? null,
        isRecurrenceInstance: false,
      });
      continue;
    }

    const rule = event.recurrenceRule as CommunityRecurrenceRule;
    if (!['weekly', 'biweekly', 'monthly'].includes(rule)) {
      expanded.push({
        ...event,
        seriesEventId: event.id,
        occurrenceStartsAt: event.startsAt.toISOString(),
        occurrenceEndsAt: event.endsAt?.toISOString() ?? null,
        isRecurrenceInstance: false,
      });
      continue;
    }

    const seriesEnd = event.recurrenceUntil ?? horizonEnd;
    let cursor = new Date(event.startsAt);
    let generated = 0;

    while (cursor <= horizonEnd && cursor <= seriesEnd && generated < maxOccurrences) {
      // cursor starts at event.startsAt and only advances forward, so
      // `cursor >= event.startsAt` was always true here — the intended
      // "skip past occurrences" filter never actually ran, and old
      // occurrences of a recurring series kept showing up indefinitely.
      if (cursor >= now) {
        const occurrenceEndsAt =
          durationMs > 0 ? new Date(cursor.getTime() + durationMs).toISOString() : null;
        expanded.push({
          ...event,
          seriesEventId: event.id,
          occurrenceStartsAt: cursor.toISOString(),
          occurrenceEndsAt,
          isRecurrenceInstance: generated > 0 || cursor.getTime() !== event.startsAt.getTime(),
        });
        generated += 1;
      }
      cursor = advanceCursor(cursor, rule);
    }
  }

  expanded.sort(
    (a, b) =>
      new Date(a.occurrenceStartsAt).getTime() - new Date(b.occurrenceStartsAt).getTime(),
  );

  return expanded.slice(0, maxOccurrences);
}
