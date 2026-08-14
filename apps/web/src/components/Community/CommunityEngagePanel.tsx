'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Room = {
  id: string;
  name: string;
  roomType: string;
  description?: string | null;
  settings?: { requiredTierId?: string };
};
type CommunityEvent = {
  id: string;
  seriesEventId: string;
  title: string;
  description?: string | null;
  startsAt?: string;
  occurrenceStartsAt: string;
  occurrenceEndsAt?: string | null;
  endsAt?: string | null;
  location?: string | null;
  isOnline?: boolean;
  eventType?: string;
  recurrenceRule?: string | null;
  isRecurrenceInstance?: boolean;
};

const LIVEKIT_ENABLED = !!process.env.NEXT_PUBLIC_LIVEKIT_URL;

interface Props {
  communityId: string;
}

export function CommunityEngagePanel({ communityId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: rooms } = useQuery({
    queryKey: ['community-rooms', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Room[] }>(`/communities/${communityId}/rooms`);
      return data.data ?? [];
    },
  });

  const { data: events } = useQuery({
    queryKey: ['community-events', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: CommunityEvent[] }>(
        `/communities/${communityId}/events`,
      );
      const payload = data.data;
      return Array.isArray(payload) ? payload : [];
    },
  });

  const voiceRooms = (rooms ?? []).filter((r) => r.roomType !== 'text');
  const textRooms = (rooms ?? []).filter((r) => r.roomType === 'text');

  const rsvpMutation = useMutation({
    mutationFn: async (eventId: string) => {
      await api.post(`/communities/${communityId}/events/${eventId}/rsvp`, { status: 'going' });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['community-events', communityId] });
    },
  });

  const hasContent =
    (events ?? []).length > 0 || voiceRooms.length > 0 || textRooms.length > 0;

  if (!hasContent) {
    return (
      <p className="text-sm text-on-surface-variant">
        No rooms or events yet — check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {(events ?? []).length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-label-caps text-xs text-outline">Events</h3>
          <ul className="space-y-2">
            {(events ?? []).map((event) => (
              <li
                key={`${event.seriesEventId}:${event.occurrenceStartsAt}`}
                className="rounded-xl border border-outline-variant/30 px-4 py-3"
              >
                <p className="font-medium text-sm">
                  {event.title}
                  {event.eventType === 'recurring' ? (
                    <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      Recurring
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {new Date(event.occurrenceStartsAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  {event.isOnline ? ' · Online' : event.location ? ` · ${event.location}` : ''}
                </p>
                {event.description ? (
                  <p className="mt-2 text-xs text-on-surface-variant">{event.description}</p>
                ) : null}
                {user ? (
                  <Button
                    variant="secondary"
                    className="mt-2 text-xs"
                    disabled={rsvpMutation.isPending}
                    onClick={() => rsvpMutation.mutate(event.seriesEventId)}
                  >
                    RSVP
                  </Button>
                ) : (
                  <p className="mt-2 text-xs text-on-surface-variant">Sign in to RSVP.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {textRooms.length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-label-caps text-xs text-outline">Text rooms</h3>
          <ul className="space-y-2">
            {textRooms.map((room) => (
              <li
                key={room.id}
                className="rounded-xl border border-outline-variant/30 px-4 py-3"
              >
                <p className="font-medium text-sm">{room.name}</p>
                {room.description ? (
                  <p className="mt-1 text-xs text-on-surface-variant">{room.description}</p>
                ) : null}
                {user ? (
                  <Link
                    href={`/community/${communityId}/text/${room.id}`}
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    Open chat →
                  </Link>
                ) : (
                  <p className="mt-2 text-xs text-on-surface-variant">Sign in to chat.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {voiceRooms.length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-label-caps text-xs text-outline">Voice & stage rooms</h3>
          <ul className="space-y-2">
            {voiceRooms.map((room) => (
              <li
                key={room.id}
                className="rounded-xl border border-outline-variant/30 px-4 py-3"
              >
                <p className="font-medium text-sm">{room.name}</p>
                <p className="text-xs text-outline">
                  {room.roomType}
                  {room.settings?.requiredTierId ? ' · VIP' : ''}
                </p>
                {user && LIVEKIT_ENABLED ? (
                  <Link
                    href={`/community/${communityId}/voice/${room.id}`}
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    Join room →
                  </Link>
                ) : (
                  <p className="mt-2 text-xs text-on-surface-variant">
                    {LIVEKIT_ENABLED ? 'Sign in to join.' : 'Voice rooms require LiveKit.'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
