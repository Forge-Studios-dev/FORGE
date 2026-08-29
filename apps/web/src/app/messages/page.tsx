'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, EmptyState } from '@forge/design-system';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-message';
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

type SearchUser = { id: string; username: string; displayName?: string };

export default function MessagesPage() {
  const { user, accessToken, isGuest } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [threadDraft, setThreadDraft] = useState('');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<SearchUser | null>(null);

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

  const { data: suggestions = [] } = useQuery({
    queryKey: ['user-search-dm', recipientQuery],
    enabled: recipientQuery.trim().length >= 2 && !selectedRecipient,
    queryFn: async () => {
      const { data } = await api.get<{ data: SearchUser[] }>(
        `/users/search?q=${encodeURIComponent(recipientQuery.trim())}&limit=5`,
      );
      return data.data;
    },
  });

  const send = useMutation({
    mutationFn: async (payload: { recipientId: string; content: string }) => {
      const { data } = await api.post<{ data: DmMessage }>('/messages', payload);
      return data.data;
    },
    onSuccess: (msg) => {
      setDraft('');
      setThreadDraft('');
      setRecipientQuery('');
      setSelectedRecipient(null);
      setActiveId(msg.conversationId);
      void qc.invalidateQueries({ queryKey: ['dm-conversations'] });
      void qc.invalidateQueries({ queryKey: ['dm-messages', msg.conversationId] });
    },
  });

  const sendError = send.isError
    ? getApiErrorMessage(send.error, 'Could not send message. Try again.')
    : null;

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
      <main className="mx-auto max-w-lg px-5 py-16">
        <EmptyState
          icon="login"
          title="Sign in to message"
          description="Direct messages with creators and other viewers require an account."
          action={{ label: 'Sign in', href: '/login?next=/messages' }}
        />
      </main>
    );
  }

  const activeConv = conversations.find((c) => c.conversationId === activeId);
  const canSend = !!selectedRecipient && draft.trim().length > 0 && !send.isPending;
  const canReply =
    !!activeConv?.participants[0]?.id && threadDraft.trim().length > 0 && !send.isPending;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-4 px-5 py-8 md:flex-row md:px-12">
      <aside className="w-full shrink-0 rounded-xl border border-outline-variant/20 md:w-72">
        <h1 className="border-b border-outline-variant/20 p-4 font-display-forge text-lg font-semibold">
          Messages
        </h1>
        {conversations.length === 0 ? (
          <p className="p-4 text-sm text-on-surface-variant">No conversations yet.</p>
        ) : (
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
        )}
        <div className="border-t border-outline-variant/20 p-4">
          <p className="mb-2 text-xs text-on-surface-variant">New message</p>
          {selectedRecipient ? (
            <div className="mb-2 flex items-center justify-between rounded-lg border border-outline-variant/40 px-3 py-2 text-sm">
              <span>
                @{selectedRecipient.username}
                {selectedRecipient.displayName ? ` · ${selectedRecipient.displayName}` : ''}
              </span>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setSelectedRecipient(null)}
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative mb-2">
              <input
                value={recipientQuery}
                onChange={(e) => setRecipientQuery(e.target.value)}
                placeholder="Search @username"
                className="w-full rounded-lg border border-outline-variant bg-transparent px-3 py-2 text-sm"
              />
              {suggestions.length > 0 ? (
                <ul className="absolute z-10 mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface-container-high shadow-lg">
                  {suggestions.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-xs hover:bg-surface-container"
                        onClick={() => {
                          setSelectedRecipient(u);
                          setRecipientQuery('');
                        }}
                      >
                        @{u.username}
                        {u.displayName ? ` · ${u.displayName}` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message…"
            rows={2}
            className="mb-2 w-full rounded-lg border border-outline-variant bg-transparent px-3 py-2 text-sm"
          />
          <Button
            type="button"
            variant="primary"
            disabled={!canSend}
            onClick={() =>
              selectedRecipient &&
              send.mutate({ recipientId: selectedRecipient.id, content: draft.trim() })
            }
            className="w-full rounded-lg py-2"
          >
            {send.isPending ? 'Sending…' : 'Send'}
          </Button>
          {sendError ? (
            <p className="mt-2 text-xs text-error" role="alert" aria-live="polite">
              {sendError}
            </p>
          ) : null}
        </div>
      </aside>

      <section className="flex flex-1 flex-col rounded-xl border border-outline-variant/20">
        {activeId ? (
          <>
            <div className="border-b border-outline-variant/20 p-4">
              <p className="font-semibold">
                {activeConv?.participants[0]?.displayName ?? 'Conversation'}
              </p>
              {activeConv?.participants[0]?.username ? (
                <p className="text-xs text-on-surface-variant">
                  @{activeConv.participants[0].username}
                </p>
              ) : null}
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
            <div className="flex gap-2 border-t border-outline-variant/20 p-4">
              <textarea
                value={threadDraft}
                onChange={(e) => setThreadDraft(e.target.value)}
                placeholder="Message…"
                rows={2}
                className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-transparent px-3 py-2 text-sm"
              />
              <Button
                type="button"
                variant="primary"
                disabled={!canReply}
                onClick={() => {
                  const peerId = activeConv?.participants[0]?.id;
                  if (!peerId) return;
                  send.mutate(
                    { recipientId: peerId, content: threadDraft.trim() },
                    {
                      onSuccess: () => setThreadDraft(''),
                    },
                  );
                }}
                className="shrink-0 self-end rounded-lg px-4 py-2"
              >
                {send.isPending ? 'Sending…' : 'Send'}
              </Button>
            </div>
            {sendError ? (
              <p className="border-t border-outline-variant/20 px-4 pb-3 text-xs text-error" role="alert" aria-live="polite">
                {sendError}
              </p>
            ) : null}
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
