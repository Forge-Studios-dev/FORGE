'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@forge/design-system';
import { SocketEvents } from '@forge/shared-types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';

type RaisedHand = { userId: string; raisedAt: string };

interface Props {
  streamId: string;
  isHost?: boolean;
}

export function StreamRaiseHandPanel({ streamId, isHost }: Props) {
  const qc = useQueryClient();
  const { user, accessToken } = useAuth();
  const [handRaised, setHandRaised] = useState(false);

  const { data: hands } = useQuery({
    queryKey: ['stream-raise-hands', streamId],
    enabled: !!streamId && (!!isHost || !!user?.id),
    refetchInterval: () => {
      const socket = accessToken ? getSocket(accessToken) : null;
      if (socket?.connected) return false;
      return isHost ? 60_000 : 90_000;
    },
    queryFn: async () => {
      const { data } = await api.get<{ data: RaisedHand[] }>(`/streams/${streamId}/raise-hands`);
      return data.data ?? [];
    },
  });

  useEffect(() => {
    if (!user?.id || isHost) return;
    setHandRaised((hands ?? []).some((h) => h.userId === user.id));
  }, [hands, user?.id, isHost]);

  useEffect(() => {
    if (!accessToken || !streamId) return;
    const socket = getSocket(accessToken);
    if (!socket) return;

    const onRaiseHand = (payload: {
      streamId?: string;
      userId?: string;
      raised?: boolean;
      raisedAt?: string;
    }) => {
      if (payload.streamId !== streamId) return;
      void qc.invalidateQueries({ queryKey: ['stream-raise-hands', streamId] });
      if (!isHost && payload.userId === user?.id) {
        setHandRaised(!!payload.raised);
      }
    };

    socket.on(SocketEvents.STREAM_RAISE_HAND, onRaiseHand);
    return () => {
      socket.off(SocketEvents.STREAM_RAISE_HAND, onRaiseHand);
    };
  }, [accessToken, streamId, isHost, user?.id, qc]);

  const raiseMutation = useMutation({
    mutationFn: async (raised: boolean) => {
      if (raised) {
        await api.post(`/streams/${streamId}/raise-hand`);
      } else {
        await api.delete(`/streams/${streamId}/raise-hand`);
      }
    },
    onSuccess: (_data, raised) => {
      setHandRaised(raised);
      void qc.invalidateQueries({ queryKey: ['stream-raise-hands', streamId] });
    },
  });

  if (isHost) {
    return (
      <div className="glass-panel space-y-2 rounded-xl p-4">
        <h3 className="text-sm font-semibold">Raised hands</h3>
        {(hands ?? []).length === 0 ? (
          <p className="text-xs text-on-surface-variant">No hands raised yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(hands ?? []).map((h) => (
              <li key={h.userId} className="rounded-lg border border-outline-variant/30 px-2 py-1">
                {h.userId.slice(0, 8)}…
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-4">
      <Button
        variant="secondary"
        className="w-full text-sm"
        disabled={raiseMutation.isPending}
        onClick={() => raiseMutation.mutate(!handRaised)}
      >
        {handRaised ? 'Lower hand' : 'Raise hand'}
      </Button>
    </div>
  );
}
