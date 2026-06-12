'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getSocket, joinRoom, leaveRoom } from '@/lib/socket';
import { SocketEvents } from '@forge/shared-types';
import { User } from '@/types';

type Conversation = {
  conversationId: string;
  lastReadAt: string | null;
  participants: User[];
};

type DmMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: User;
};

export default function MessagesPage() {
  const { user, accessToken, isGuest } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [recipientId, setRecipientId] = useState('');

  const { data: conversations = [] } = useQuery({
    queryKey: ['dm-conversations'],
    enabled: !!accessToken,
    queryFn: async () => {
      const { data } = await api.get<{ data: Conversation[] }>('/messages/conversations');
      return data.data;
    },
  });

  const { data: messagesData } = useQuery({
    queryKey: ['dm-messages', activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: DmMessage[] } }>(
        `/messages/conversations/${activeId}?limit=50`,
      );
      return data.data.data;
    },
  });

  const send = useMutation({
    mutationFn: async (payload: { recipientId: string; content: string }) => {
      const { data } = await api.post<{ data: DmMessage }>('/messages', payload);
      return data.data;
    },
    onSuccess: (msg) => {
      setDraft('');
      setRecipientId('');
      setActiveId(msg.conversationId);
      void qc.invalidateQueries({ queryKey: ['dm-conversations'] });
      void qc.invalidateQueries({ queryKey: ['dm-messages', msg.conversationId] });
    },
  });

  useEffect(() => {
    if (!accessToken || !activeId) return;
    const socket = getSocket(accessToken);
    if (!socket) return;

    void api.post(`/messages/conversations/${activeId}/read`);

    joinRoom('join-conversation', { conversationId: activeId });
    const onMsg = () => {
      void qc.invalidateQueries({ queryKey: ['dm-messages', activeId] });
    };
    socket.on(SocketEvents.DM_MESSAGE, onMsg);

    return () => {
      leaveRoom('leave-conversation', { conversationId: activeId });
      socket.off(SocketEvents.DM_MESSAGE, onMsg);
    };
  }, [accessToken, activeId, qc]);

  if (isGuest) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="text-on-surface-variant">Sign in to view messages.</p>
        <Link href="/login" className="mt-4 inline-block text-primary hover:underline">
          Sign in
        </Link>
      </main>
    );
  }

  const activeConv = conversations.find((c) => c.conversationId === activeId);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-4 px-5 py-8 md:flex-row md:px-12">
      <aside className="w-full shrink-0 rounded-xl border border-outline-variant/20 md:w-72">
        <h1 className="border-b border-outline-variant/20 p-4 font-display-forge text-lg font-semibold">
          Messages
        </h1>
        <ul className="max-h-96 overflow-y-auto">
          {conversations.map((c) => {
            const peer = c.participants[0];
            return (
              <li key={c.conversationId}>
                <button
                  type="button"
                  onClick={() => setActiveId(c.conversationId)}
                  className={`w-full px-4 py-3 text-left hover:bg-surface-container-high ${
                    activeId === c.conversationId ? 'bg-surface-container-high' : ''
                  }`}
                >
                  <p className="font-medium">{peer?.displayName ?? 'User'}</p>
                  <p className="text-xs text-on-surface-variant">@{peer?.username}</p>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-outline-variant/20 p-4">
          <p className="mb-2 text-xs text-on-surface-variant">New message (user ID)</p>
          <input
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            placeholder="Recipient user ID"
            className="mb-2 w-full rounded-lg border border-outline-variant bg-transparent px-3 py-2 text-sm"
          />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message…"
            rows={2}
            className="mb-2 w-full rounded-lg border border-outline-variant bg-transparent px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!recipientId.trim() || !draft.trim() || send.isPending}
            onClick={() => send.mutate({ recipientId: recipientId.trim(), content: draft.trim() })}
            className="primary-button w-full rounded-lg py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </aside>

      <section className="flex flex-1 flex-col rounded-xl border border-outline-variant/20">
        {activeId ? (
          <>
            <div className="border-b border-outline-variant/20 p-4">
              <p className="font-semibold">{activeConv?.participants[0]?.displayName ?? 'Conversation'}</p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messagesData?.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    m.senderId === user?.id
                      ? 'ml-auto bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface'
                  }`}
                >
                  {m.content}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="flex flex-1 items-center justify-center text-on-surface-variant">
            Select a conversation
          </p>
        )}
      </section>
    </main>
  );
}
