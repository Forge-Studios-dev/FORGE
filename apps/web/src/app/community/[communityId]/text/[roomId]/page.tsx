'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@forge/design-system';
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
  const [replyTo, setReplyTo] = useState<RoomMessage | null>(null);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
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

  const threadedMessages = useMemo(() => {
    const byId = new Map(messages.map((m) => [m.id, m]));
    const roots = messages.filter((m) => !m.parentMessageId);
    const repliesByParent = new Map<string, RoomMessage[]>();
    for (const m of messages) {
      if (m.parentMessageId) {
        const list = repliesByParent.get(m.parentMessageId) ?? [];
        list.push(m);
        repliesByParent.set(m.parentMessageId, list);
      }
    }
    const result: Array<{ message: RoomMessage; depth: number }> = [];
    for (const root of roots) {
      result.push({ message: root, depth: 0 });
      for (const reply of repliesByParent.get(root.id) ?? []) {
        result.push({ message: reply, depth: 1 });
      }
    }
    for (const m of messages) {
      if (m.parentMessageId && !byId.has(m.parentMessageId)) {
        result.push({ message: m, depth: 1 });
      }
    }
    return result;
  }, [messages]);

  const reportMessageMutation = useMutation({
    mutationFn: async ({ messageId, reason }: { messageId: string; reason: string }) => {
      await api.post(`/communities/${communityId}/reports`, {
        targetType: 'message',
        roomId,
        messageId,
        reason,
      });
    },
    onSuccess: () => setReportingMessageId(null),
  });

  const sendMutation = useMutation({
    mutationFn: async ({ body, parentMessageId }: { body: string; parentMessageId?: string }) => {
      const { data } = await api.post<{ data: RoomMessage }>(
        `/communities/${communityId}/rooms/${roomId}/messages`,
        { body, parentMessageId },
      );
      return data.data;
    },
    onSuccess: (message) => {
      setDraft('');
      setReplyTo(null);
      if (message) {
        qc.setQueryData<RoomMessage[]>(['room-messages', communityId, roomId], (prev = []) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      } else {
        void refetch();
      }
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
        {threadedMessages.map(({ message: msg, depth }) => {
          const parent = msg.parentMessageId
            ? messages.find((m) => m.id === msg.parentMessageId)
            : null;
          return (
            <div
              key={msg.id}
              className="text-sm"
              style={{ paddingLeft: depth > 0 ? `${depth * 16}px` : undefined }}
            >
              {depth > 0 && parent ? (
                <p className="text-[10px] text-outline">
                  ↳ reply to {parent.user?.displayName ?? parent.user?.username ?? 'message'}
                </p>
              ) : null}
              <div className="flex items-start justify-between gap-2">
                <div>
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
                {user && !msg.deletedAt ? (
                  <div className="flex shrink-0 items-center gap-1">
                    {msg.userId !== user.id ? (
                      reportingMessageId === msg.id ? (
                        <form
                          className="flex gap-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            const reason = String(fd.get('reason') ?? '').trim();
                            if (!reason) return;
                            reportMessageMutation.mutate({ messageId: msg.id, reason });
                          }}
                        >
                          <Input name="reason" placeholder="Reason" className="h-7 w-24 text-xs" />
                          <Button type="submit" className="px-2 py-0 text-xs">
                            Report
                          </Button>
                        </form>
                      ) : (
                        <Button
                          variant="ghost"
                          className="px-2 py-0 text-xs text-outline"
                          onClick={() => setReportingMessageId(msg.id)}
                        >
                          Report
                        </Button>
                      )
                    ) : null}
                    <Button
                      variant="ghost"
                      className="px-2 py-0 text-xs"
                      onClick={() => setReplyTo(msg)}
                    >
                      Reply
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          sendMutation.mutate({ body: draft.trim(), parentMessageId: replyTo?.id });
        }}
      >
        {replyTo ? (
          <p className="text-xs text-on-surface-variant">
            Replying to {replyTo.user?.displayName ?? replyTo.user?.username ?? 'message'}
            <button type="button" className="ml-2 text-primary" onClick={() => setReplyTo(null)}>
              Cancel
            </button>
          </p>
        ) : null}
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={replyTo ? 'Write a reply…' : 'Message this room…'}
            disabled={sendMutation.isPending}
          />
          <Button type="submit" disabled={sendMutation.isPending || !draft.trim()}>
            Send
          </Button>
        </div>
      </form>
    </main>
  );
}
