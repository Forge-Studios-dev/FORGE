'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/lib/auth';
import { SocketEvents } from '@forge/shared-types';

const REACTIONS = ['heart', 'fire', 'clap', '100'] as const;
const REACTION_EMOJI: Record<string, string> = {
  heart: '❤️',
  fire: '🔥',
  clap: '👏',
  '100': '💯',
};

type ReactionPayload = {
  streamId: string;
  reaction: string;
  count: number;
};

export function StreamReactionPanel({ streamId }: { streamId: string }) {
  const { accessToken } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    void api.get<{ data: Record<string, number> }>(`/streams/${streamId}/reactions`).then(({ data }) => {
      setCounts(data.data ?? {});
    });
  }, [streamId]);

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    if (!socket) return;

    const onReaction = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as ReactionPayload;
      if (p.streamId !== streamId) return;
      setCounts((prev) => ({ ...prev, [p.reaction]: p.count }));
    };

    socket.on(SocketEvents.STREAM_REACTION, onReaction);
    return () => {
      socket.off(SocketEvents.STREAM_REACTION, onReaction);
    };
  }, [accessToken, streamId]);

  const react = (reaction: string) => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    socket?.emit('stream:react', { streamId, reaction });
  };

  const topReactions = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex flex-col items-center gap-3 px-4">
      {topReactions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {topReactions.map(([reaction, count]) => (
            <span
              key={reaction}
              className="rounded-full bg-surface/80 px-3 py-1 text-sm font-medium backdrop-blur"
            >
              {REACTION_EMOJI[reaction] ?? reaction} {count}
            </span>
          ))}
        </div>
      )}
      <div className="pointer-events-auto flex gap-2 rounded-full border border-outline-variant/30 bg-surface/90 p-2 backdrop-blur">
        {REACTIONS.map((reaction) => (
          <button
            key={reaction}
            type="button"
            onClick={() => react(reaction)}
            className="rounded-full px-3 py-1.5 text-lg transition hover:bg-surface-container-high"
            aria-label={`React with ${reaction}`}
          >
            {REACTION_EMOJI[reaction]}
          </button>
        ))}
      </div>
    </div>
  );
}
