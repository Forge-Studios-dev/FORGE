'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@forge/design-system';
import { api } from '@/lib/api';

type CommunityEvent = {
  id: string;
  seriesEventId?: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  isOnline?: boolean;
  eventType?: string;
  recurrenceRule?: string | null;
  recurrenceUntil?: string | null;
};

type EventRsvp = {
  id: string;
  userId: string;
  status: string;
  createdAt: string;
};

interface Props {
  communityId: string;
  onCreated?: () => void;
}

function formatEventTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StudioCommunityEventsPanel({ communityId, onCreated }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [eventType, setEventType] = useState<'one_off' | 'recurring'>('one_off');
  const [recurrenceRule, setRecurrenceRule] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');
  const [expandedRsvpsEventId, setExpandedRsvpsEventId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editEndsAt, setEditEndsAt] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editIsOnline, setEditIsOnline] = useState(true);
  const [editEventType, setEditEventType] = useState<'one_off' | 'recurring'>('one_off');
  const [editRecurrenceRule, setEditRecurrenceRule] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [editRecurrenceUntil, setEditRecurrenceUntil] = useState('');

  const { data: events, isLoading } = useQuery({
    queryKey: ['studio-community-events', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: CommunityEvent[] }>(
        `/communities/${communityId}/events?seriesOnly=1`,
      );
      const payload = data.data;
      return Array.isArray(payload) ? payload : [];
    },
  });

  const { data: rsvps } = useQuery({
    queryKey: ['studio-event-rsvps', communityId, expandedRsvpsEventId],
    enabled: !!expandedRsvpsEventId,
    queryFn: async () => {
      const { data } = await api.get<{ data: EventRsvp[] }>(
        `/creators/me/communities/${communityId}/events/${expandedRsvpsEventId}/rsvps`,
      );
      const payload = data.data;
      return Array.isArray(payload) ? payload : [];
    },
  });

  const invalidateEvents = () => {
    void qc.invalidateQueries({ queryKey: ['studio-community-events', communityId] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/creators/me/communities/${communityId}/events`, {
        title: title.trim(),
        description: description.trim() || undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        location: isOnline ? undefined : location.trim() || undefined,
        isOnline,
        eventType,
        recurrenceRule: eventType === 'recurring' ? recurrenceRule : undefined,
        recurrenceUntil:
          eventType === 'recurring' && recurrenceUntil
            ? new Date(recurrenceUntil).toISOString()
            : undefined,
      });
    },
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setStartsAt('');
      setEndsAt('');
      setLocation('');
      setIsOnline(true);
      setEventType('one_off');
      setRecurrenceUntil('');
      invalidateEvents();
      onCreated?.();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (eventId: string) => {
      await api.patch(`/creators/me/communities/${communityId}/events/${eventId}`, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        startsAt: new Date(editStartsAt).toISOString(),
        endsAt: editEndsAt ? new Date(editEndsAt).toISOString() : null,
        location: editIsOnline ? null : editLocation.trim() || null,
        isOnline: editIsOnline,
        eventType: editEventType,
        recurrenceRule: editEventType === 'recurring' ? editRecurrenceRule : null,
        recurrenceUntil:
          editEventType === 'recurring' && editRecurrenceUntil
            ? new Date(editRecurrenceUntil).toISOString()
            : null,
      });
    },
    onSuccess: () => {
      setEditingEventId(null);
      invalidateEvents();
      onCreated?.();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      await api.delete(`/creators/me/communities/${communityId}/events/${eventId}`);
    },
    onSuccess: () => {
      setExpandedRsvpsEventId(null);
      invalidateEvents();
    },
  });

  const startEdit = (event: CommunityEvent) => {
    setEditingEventId(event.id);
    setEditTitle(event.title);
    setEditDescription(event.description ?? '');
    setEditStartsAt(toLocalInputValue(event.startsAt));
    setEditEndsAt(event.endsAt ? toLocalInputValue(event.endsAt) : '');
    setEditLocation(event.location ?? '');
    setEditIsOnline(event.isOnline ?? true);
    setEditEventType(event.eventType === 'recurring' ? 'recurring' : 'one_off');
    setEditRecurrenceRule(
      (event.recurrenceRule as 'weekly' | 'biweekly' | 'monthly') ?? 'weekly',
    );
    setEditRecurrenceUntil(
      event.recurrenceUntil ? toLocalInputValue(event.recurrenceUntil) : '',
    );
  };

  const canCreate = title.trim().length > 0 && startsAt.length > 0;

  return (
    <div className="space-y-6">
      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">Schedule event</h2>
        <p className="text-xs text-on-surface-variant">
          Members can RSVP from the community Rooms tab. Online events show as virtual by default.
        </p>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={3}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
        />
        <label className="block text-xs text-on-surface-variant">Starts at</label>
        <Input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
        <label className="block text-xs text-on-surface-variant">Ends at (optional)</label>
        <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isOnline}
            onChange={(e) => setIsOnline(e.target.checked)}
          />
          Online event
        </label>
        {!isOnline ? (
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
          />
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={eventType === 'recurring'}
            onChange={(e) => setEventType(e.target.checked ? 'recurring' : 'one_off')}
          />
          Recurring (office hours)
        </label>
        {eventType === 'recurring' ? (
          <>
            <select
              value={recurrenceRule}
              onChange={(e) =>
                setRecurrenceRule(e.target.value as 'weekly' | 'biweekly' | 'monthly')
              }
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <label className="block text-xs text-on-surface-variant">Repeat until (optional)</label>
            <Input
              type="datetime-local"
              value={recurrenceUntil}
              onChange={(e) => setRecurrenceUntil(e.target.value)}
            />
          </>
        ) : null}
        <Button
          disabled={!canCreate || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? 'Creating…' : 'Create event'}
        </Button>
      </section>

      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">Upcoming events</h2>
        {isLoading ? (
          <p className="text-sm text-on-surface-variant">Loading…</p>
        ) : (events ?? []).length === 0 ? (
          <p className="text-sm text-on-surface-variant">No events scheduled yet.</p>
        ) : (
          <ul className="space-y-3">
            {(events ?? []).map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-outline-variant/30 p-4 text-sm"
              >
                {editingEventId === event.id ? (
                  <div className="space-y-2">
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
                    />
                    <Input
                      type="datetime-local"
                      value={editStartsAt}
                      onChange={(e) => setEditStartsAt(e.target.value)}
                    />
                    <Input
                      type="datetime-local"
                      value={editEndsAt}
                      onChange={(e) => setEditEndsAt(e.target.value)}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editIsOnline}
                        onChange={(e) => setEditIsOnline(e.target.checked)}
                      />
                      Online event
                    </label>
                    {!editIsOnline ? (
                      <Input
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        placeholder="Location"
                      />
                    ) : null}
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editEventType === 'recurring'}
                        onChange={(e) =>
                          setEditEventType(e.target.checked ? 'recurring' : 'one_off')
                        }
                      />
                      Recurring
                    </label>
                    {editEventType === 'recurring' ? (
                      <>
                        <select
                          value={editRecurrenceRule}
                          onChange={(e) =>
                            setEditRecurrenceRule(
                              e.target.value as 'weekly' | 'biweekly' | 'monthly',
                            )
                          }
                          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
                        >
                          <option value="weekly">Weekly</option>
                          <option value="biweekly">Biweekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                        <Input
                          type="datetime-local"
                          value={editRecurrenceUntil}
                          onChange={(e) => setEditRecurrenceUntil(e.target.value)}
                        />
                      </>
                    ) : null}
                    <div className="flex gap-2">
                      <Button
                        disabled={updateMutation.isPending || !editTitle.trim()}
                        onClick={() => updateMutation.mutate(event.id)}
                      >
                        Save
                      </Button>
                      <Button variant="ghost" onClick={() => setEditingEventId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-medium">
                      {event.title}
                      {event.eventType === 'recurring' ? (
                        <span className="ml-2 text-xs text-primary">
                          · {event.recurrenceRule ?? 'recurring'}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {formatEventTime(event.startsAt)}
                      {event.isOnline ? ' · Online' : event.location ? ` · ${event.location}` : ''}
                    </p>
                    {event.description ? (
                      <p className="mt-2 text-xs text-on-surface-variant">{event.description}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        className="px-0 text-xs"
                        onClick={() =>
                          setExpandedRsvpsEventId((cur) => (cur === event.id ? null : event.id))
                        }
                      >
                        {expandedRsvpsEventId === event.id ? 'Hide RSVPs' : 'View RSVPs'}
                      </Button>
                      <Button variant="ghost" className="px-0 text-xs" onClick={() => startEdit(event)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-0 text-xs text-error"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm('Delete this event?')) {
                            deleteMutation.mutate(event.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </>
                )}
                {expandedRsvpsEventId === event.id && editingEventId !== event.id ? (
                  <ul className="mt-2 space-y-1 border-t border-outline-variant/20 pt-2">
                    {(rsvps ?? []).length === 0 ? (
                      <li className="text-xs text-on-surface-variant">No RSVPs yet.</li>
                    ) : (
                      (rsvps ?? []).map((row) => (
                        <li key={row.id} className="text-xs text-on-surface-variant">
                          {row.userId.slice(0, 8)}… · {row.status} ·{' '}
                          {new Date(row.createdAt).toLocaleString()}
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
