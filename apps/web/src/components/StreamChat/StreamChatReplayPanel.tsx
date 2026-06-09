'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

type ChatMessage = {
  id: string;
  userId: string;
  user?: { displayName?: string; username?: string };
  body: string;
  streamOffsetMs?: number | null;
  messageType?: string;
  amountCents?: number | null;
};

type Props = {
  streamId: string;
  playbackSeconds: number;
};

const WINDOW_SEC = 30;

export function StreamChatReplayPanel({ streamId, playbackSeconds }: Props) {
  const playbackMs = Math.floor(playbackSeconds * 1000);
  const fromMs = Math.max(0, playbackMs - WINDOW_SEC * 1000);
  const toMs = playbackMs + WINDOW_SEC * 1000;
  const bottomRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  const { data } = useQuery({
    queryKey: ['stream-chat-replay', streamId, fromMs, toMs],
    enabled: streamId.length > 0 && playbackMs > 0,
    queryFn: async () => {
      const { data: res } = await api.get<{ data: { data: ChatMessage[] } }>(
        `/streams/${streamId}/chat?fromMs=${fromMs}&toMs=${toMs}&limit=200`,
      );
      return res.data.data;
    },
    staleTime: 10_000,
  });

  const visible = useMemo(() => {
    if (!data?.length) return [];
    return data.filter((m) => {
      const offset = m.streamOffsetMs ?? 0;
      return offset <= playbackMs;
    });
  }, [data, playbackMs]);

  useEffect(() => {
    if (!loaded && visible.length) setLoaded(true);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visible.length, loaded]);

  const displayName = (m: ChatMessage) => {
    if (m.user?.username) return `@${m.user.username}`;
    return m.user?.displayName ?? 'Viewer';
  };

  return (
    <div className="glass-panel flex h-[360px] flex-col rounded-xl">
      <div className="border-b border-outline-variant/30 px-4 py-3">
        <span className="font-medium">Chat replay</span>
        <p className="text-xs text-on-surface-variant">Synced to playback</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {!visible.length ? (
          <p className="text-sm text-on-surface-variant">No chat at this moment.</p>
        ) : (
          visible.map((m) => (
            <div
              key={m.id}
              className={`text-sm ${m.messageType === 'super_chat' ? 'rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1' : ''}`}
            >
              <span className="font-medium text-primary">{displayName(m)}</span>
              {m.messageType === 'super_chat' && m.amountCents ? (
                <span className="ml-1 text-xs text-amber-400">
                  ${(m.amountCents / 100).toFixed(2)}
                </span>
              ) : null}
              <span className="text-on-surface-variant"> · </span>
              <span>{m.body}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
