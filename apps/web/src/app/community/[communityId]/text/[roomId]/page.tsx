'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@forge/design-system';
import { SocketEvents } from '@forge/shared-types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';

type RoomMessage = {
  id: string;
  roomId: string;
  userId: string;
  user?: { id: string; username?: string; displayName?: string };
  memberTierName?: string | null;
  body: string;
  parentMessageId?: string | null;
  deletedAt?: string | null;
  createdAt: string;
};

export default function CommunityTextRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user, accessToken, isGuest } = useAuth();
  const qc = useQueryClient();
  const communityId = params.communityId as string;
  const roomId = params.roomId as string;
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: room } = useQuery({
    queryKey: ['community-room', communityId, roomId],
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: string; name: string; roomType: string } }>(
        `/communities/${communityId}/rooms/${roomId}`,
      );
      return data.data;
    },
  });

  const { data: messages = [], refetch } = useQuery({
    queryKey: ['room-messages', communityId, roomId],
    queryFn: async () => {
      const { data } = await api.get<{ data: RoomMessage[] }>(
        `/communities/${communityId}/rooms/${roomId}/messages`,
      );
      return data.data ?? [];
    },
    enabled: !!communityId && !!roomId,
  });

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      await api.post(`/communities/${communityId}/rooms/${roomId}/messages`, { body });
    },
    onSuccess: () => {
      setDraft('');
      void refetch();
    },
  });

  const appendMessage = useCallback(
    (msg: RoomMessage) => {
      qc.setQueryData<RoomMessage[]>(['room-messages', communityId, roomId], (prev = []) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    },
    [communityId, roomId, qc],
  );

  const markDeleted = useCallback(
    (messageId: string) => {
      qc.setQueryData<RoomMessage[]>(['room-messages', communityId, roomId], (prev = []) =>
        prev.map((m) => (m.id === messageId ? { ...m, body: '[deleted]' } : m)),
      );
    },
    [communityId, roomId, qc],
  );

  useEffect(() => {
    if (!accessToken || !roomId || !communityId) return;
    const socket = getSocket(accessToken);
    if (!socket) return;

    socket.emit('join-room', { communityId, roomId });
    const onMessage = (payload: unknown) => {
      if (payload && typeof payload === 'object' && 'id' in payload) {
        appendMessage(payload as RoomMessage);
      }
    };
    const onDelete = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as { messageId?: string };
      if (p.messageId) markDeleted(p.messageId);
    };
    socket.on('room:message', onMessage);
    socket.on('room:message:delete', onDelete);

    return () => {
      socket.emit('leave-room', { roomId });
      socket.off('room:message', onMessage);
      socket.off('room:message:delete', onDelete);
    };
  }, [accessToken, communityId, roomId, appendMessage, markDeleted]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (isGuest) {
    return (
      <main className="mx-auto max-w-lg px-5 py-12">
        <p className="text-sm">Sign in to join this text room.</p>
      </main>
    );
  }

  if (room && room.roomType !== 'text') {
    return (
      <main className="mx-auto max-w-lg px-5 py-12">
        <p className="text-sm">This room is not a text room.</p>
        <Button variant="secondary" className="mt-4" onClick={() => router.back()}>
          Go back
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{room?.name ?? 'Text room'}</h1>
          <p className="text-xs text-on-surface-variant">Community text room</p>
        </div>
        <Button variant="secondary" className="text-xs" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-outline-variant/30 p-4">
        {messages.map((msg) => (
          <div key={msg.id} className="text-sm">
            <span className="font-medium text-primary">
              {msg.user?.displayName ?? msg.user?.username ?? msg.userId.slice(0, 8)}
            </span>
            {msg.memberTierName ? (
              <span className="ml-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {msg.memberTierName}
              </span>
            ) : null}
            <span className="ml-2 text-on-surface-variant">{msg.body}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          sendMutation.mutate(draft.trim());
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message this room…"
          disabled={sendMutation.isPending}
        />
        <Button type="submit" disabled={sendMutation.isPending || !draft.trim()}>
          Send
        </Button>
      </form>
    </main>
  );
}
