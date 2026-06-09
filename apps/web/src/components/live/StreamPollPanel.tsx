'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import { SocketEvents } from '@forge/shared-types';

type Poll = {
  id: string;
  question: string;
  options: string[];
  counts: number[];
  totalVotes: number;
  isActive: boolean;
};

type Props = {
  streamId: string;
  isHost?: boolean;
};

export function StreamPollPanel({ streamId, isHost }: Props) {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [showCreate, setShowCreate] = useState(false);

  const { data: poll } = useQuery({
    queryKey: ['stream-poll', streamId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Poll | null }>(`/streams/${streamId}/poll`);
      return data.data;
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (optionIndex: number) => {
      if (!poll) return;
      await api.post(`/streams/${streamId}/polls/${poll.id}/vote`, { optionIndex });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stream-poll', streamId] }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmed = options.map((o) => o.trim()).filter(Boolean);
      await api.post(`/streams/${streamId}/polls`, { question: question.trim(), options: trimmed });
    },
    onSuccess: () => {
      setQuestion('');
      setOptions(['', '']);
      setShowCreate(false);
      void qc.invalidateQueries({ queryKey: ['stream-poll', streamId] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!poll) return;
      await api.post(`/streams/${streamId}/polls/${poll.id}/close`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['stream-poll', streamId] }),
  });

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    if (!socket) return;
    const onPoll = () => void qc.invalidateQueries({ queryKey: ['stream-poll', streamId] });
    socket.on(SocketEvents.STREAM_POLL_UPDATED, onPoll);
    return () => {
      socket.off(SocketEvents.STREAM_POLL_UPDATED, onPoll);
    };
  }, [accessToken, qc, streamId]);

  if (isHost && !poll?.isActive && !showCreate) {
    return (
      <div className="glass-panel rounded-xl p-4 text-sm">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary"
        >
          Create poll
        </button>
      </div>
    );
  }

  if (isHost && showCreate && !poll?.isActive) {
    return (
      <div className="glass-panel space-y-3 rounded-xl p-4 text-sm">
        <p className="font-medium">New poll</p>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Question"
          className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-high px-3 py-2"
        />
        {options.map((opt, i) => (
          <input
            key={i}
            value={opt}
            onChange={(e) => {
              const next = [...options];
              next[i] = e.target.value;
              setOptions(next);
            }}
            placeholder={`Option ${i + 1}`}
            className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-high px-3 py-2"
          />
        ))}
        {options.length < 6 ? (
          <button
            type="button"
            onClick={() => setOptions([...options, ''])}
            className="text-xs text-primary hover:underline"
          >
            + Add option
          </button>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={
              createMutation.isPending ||
              !question.trim() ||
              options.filter((o) => o.trim()).length < 2
            }
            onClick={() => createMutation.mutate()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Start poll'}
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(false)}
            className="rounded-lg border border-outline-variant/40 px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!poll?.isActive) return null;

  return (
    <div className="glass-panel space-y-3 rounded-xl p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{poll.question}</p>
        {isHost ? (
          <button
            type="button"
            disabled={closeMutation.isPending}
            onClick={() => closeMutation.mutate()}
            className="shrink-0 text-xs text-error hover:underline disabled:opacity-50"
          >
            Close
          </button>
        ) : null}
      </div>
      <div className="space-y-2">
        {poll.options.map((opt, i) => {
          const pct = poll.totalVotes ? Math.round((poll.counts[i] / poll.totalVotes) * 100) : 0;
          return (
            <button
              key={opt}
              type="button"
              disabled={voteMutation.isPending || isHost}
              onClick={() => voteMutation.mutate(i)}
              className="relative w-full overflow-hidden rounded-lg border border-outline-variant/30 px-3 py-2 text-left disabled:opacity-70"
            >
              <div
                className="absolute inset-y-0 left-0 bg-primary/15"
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex justify-between gap-2">
                <span>{opt}</span>
                <span className="text-on-surface-variant">{pct}%</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
