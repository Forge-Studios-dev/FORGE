'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Stream } from '@/types';
import { resolveStreamPoster } from '@/lib/stream-poster';
import { useAuth } from '@/lib/auth';

type Props = {
  stream: Stream;
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Starting soon';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function StreamCountdownLobby({ stream }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [remaining, setRemaining] = useState(0);
  const poster = resolveStreamPoster(stream);

  const { data: rsvp } = useQuery({
    queryKey: ['stream-rsvp', stream.id],
    queryFn: async () => {
      const { data } = await api.get<{ data: { rsvpCount: number; hasRsvp: boolean } }>(
        `/streams/${stream.id}/rsvp`,
      );
      return data.data;
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: async () => {
      if (rsvp?.hasRsvp) {
        await api.post(`/streams/${stream.id}/rsvp/cancel`);
      } else {
        await api.post(`/streams/${stream.id}/rsvp`);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stream-rsvp', stream.id] }),
  });

  useEffect(() => {
    if (!stream.scheduledAt) return;
    const target = new Date(stream.scheduledAt).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [stream.scheduledAt]);

  return (
    <div className="glass-panel relative aspect-video overflow-hidden">
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
      ) : null}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 px-6 text-center">
        <p className="font-label-caps text-secondary">Scheduled session</p>
        <h2 className="font-display-forge text-xl font-semibold">{stream.title}</h2>
        <p className="text-3xl font-bold tabular-nums text-primary">{formatCountdown(remaining)}</p>
        <p className="text-sm text-on-surface-variant">
          Starts {stream.scheduledAt ? new Date(stream.scheduledAt).toLocaleString() : 'soon'}
        </p>
        {rsvp?.rsvpCount ? (
          <p className="text-xs text-on-surface-variant">{rsvp.rsvpCount} waiting</p>
        ) : null}
        {user ? (
          <button
            type="button"
            disabled={rsvpMutation.isPending}
            onClick={() => rsvpMutation.mutate()}
            className="mt-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            {rsvpMutation.isPending
              ? 'Saving…'
              : rsvp?.hasRsvp
                ? 'Cancel reminder'
                : 'Remind me'}
          </button>
        ) : (
          <p className="text-xs text-on-surface-variant">Sign in to get a reminder</p>
        )}
      </div>
    </div>
  );
}
