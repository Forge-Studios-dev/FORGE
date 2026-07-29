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
  communityId: string;
  roomId: string;
  isHost: boolean;
  canPublish: boolean;
  onSpeakerApproved: () => void;
}

export function CommunityStageRaiseHandPanel({
  communityId,
  roomId,
  isHost,
  canPublish,
  onSpeakerApproved,
}: Props) {
  const qc = useQueryClient();
  const { user, accessToken } = useAuth();
  const [handRaised, setHandRaised] = useState(false);

  const { data: raisedHands } = useQuery({
    queryKey: ['community-room-raise-hands', communityId, roomId],
    queryFn: async () => {
      const { data } = await api.get<{ data: RaisedHand[] }>(
        `/communities/${communityId}/rooms/${roomId}/raise-hands`,
      );
      return data.data ?? [];
    },
    enabled: !!user?.id && isHost,
    refetchInterval: () => {
      const socket = accessToken ? getSocket(accessToken) : null;
      if (socket?.connected) return false;
      return 60_000;
    },
  });

  useEffect(() => {
    if (!user?.id || isHost) return;
    setHandRaised((raisedHands ?? []).some((h) => h.userId === user.id));
  }, [raisedHands, user?.id, isHost]);

  useEffect(() => {
    if (!accessToken || !roomId) return;
    const socket = getSocket(accessToken);
    if (!socket) return;

    socket.emit('join-room', { roomId });

    const onRaiseHand = (payload: {
      roomId?: string;
      userId?: string;
      raised?: boolean;
    }) => {
      if (payload.roomId !== roomId) return;
      void qc.invalidateQueries({
        queryKey: ['community-room-raise-hands', communityId, roomId],
      });
      if (!isHost && payload.userId === user?.id) {
        setHandRaised(!!payload.raised);
      }
    };

    const onApproved = (payload: { roomId?: string; userId?: string }) => {
      if (payload.roomId !== roomId) return;
      void qc.invalidateQueries({
        queryKey: ['community-room-raise-hands', communityId, roomId],
      });
      if (payload.userId === user?.id) {
        onSpeakerApproved();
      }
    };

    socket.on(SocketEvents.ROOM_RAISE_HAND, onRaiseHand);
    socket.on(SocketEvents.ROOM_SPEAKER_APPROVED, onApproved);
    return () => {
      socket.off(SocketEvents.ROOM_RAISE_HAND, onRaiseHand);
      socket.off(SocketEvents.ROOM_SPEAKER_APPROVED, onApproved);
      socket.emit('leave-room', { roomId });
    };
  }, [accessToken, roomId, communityId, isHost, user?.id, qc, onSpeakerApproved]);

  const toggleMutation = useMutation({
    mutationFn: async (raised: boolean) => {
      if (raised) {
        await api.post(`/communities/${communityId}/rooms/${roomId}/raise-hand`);
      } else {
        await api.delete(`/communities/${communityId}/rooms/${roomId}/raise-hand`);
      }
    },
    onSuccess: (_data, raised) => {
      setHandRaised(raised);
      void qc.invalidateQueries({
        queryKey: ['community-room-raise-hands', communityId, roomId],
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      await api.post(
        `/communities/${communityId}/rooms/${roomId}/raise-hand/${targetUserId}/approve`,
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['community-room-raise-hands', communityId, roomId],
      });
      onSpeakerApproved();
    },
  });

  if (isHost) {
    return (
      <div className="space-y-2 rounded-xl border border-outline-variant/30 p-4">
        <p className="text-xs font-label-caps text-outline">Raised hands</p>
        {(raisedHands ?? []).length === 0 ? (
          <p className="text-xs text-on-surface-variant">No raised hands yet.</p>
        ) : (
          <ul className="space-y-2">
            {(raisedHands ?? []).map((hand) => (
              <li key={hand.userId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-mono text-xs">{hand.userId.slice(0, 8)}…</span>
                <Button
                  variant="secondary"
                  className="text-xs"
                  disabled={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(hand.userId)}
                >
                  Invite to speak
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (canPublish) {
    return (
      <p className="mb-3 text-xs text-on-surface-variant">You are approved to speak on stage.</p>
    );
  }

  return (
    <div className="mb-3">
      <Button
        variant="secondary"
        className="w-full text-sm"
        disabled={toggleMutation.isPending}
        onClick={() => toggleMutation.mutate(!handRaised)}
      >
        {handRaised ? 'Lower hand' : 'Raise hand to speak'}
      </Button>
    </div>
  );
}
