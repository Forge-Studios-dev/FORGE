'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import { SocketEvents } from '@forge/shared-types';

type QuestionStatus = 'pending' | 'answered' | 'dismissed';

type Question = {
  id: string;
  body: string;
  status: QuestionStatus;
  upvotes: number;
  viewerHasUpvoted: boolean;
  user?: { displayName?: string; username?: string };
};

type Props = {
  streamId: string;
  isHost?: boolean;
};

const STATUS_LABEL: Record<QuestionStatus, string> = {
  pending: 'Pending',
  answered: 'Answered',
  dismissed: 'Dismissed',
};

export function StreamQaPanel({ streamId, isHost }: Props) {
  const { accessToken, user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');

  const queryKey = ['stream-qa', streamId];

  const { data: questions } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get<{ data: Question[] }>(`/streams/${streamId}/qa`);
      return data.data ?? [];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/streams/${streamId}/qa`, { body: draft.trim() });
    },
    onSuccess: () => {
      setDraft('');
      void qc.invalidateQueries({ queryKey });
    },
  });

  const upvoteMutation = useMutation({
    mutationFn: async (questionId: string) => {
      await api.post(`/streams/${streamId}/qa/${questionId}/upvote`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ questionId, status }: { questionId: string; status: QuestionStatus }) => {
      await api.patch(`/streams/${streamId}/qa/${questionId}/status`, { status });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    if (!socket) return;
    const refresh = () => void qc.invalidateQueries({ queryKey });
    socket.on(SocketEvents.STREAM_QA_CREATED, refresh);
    socket.on(SocketEvents.STREAM_QA_UPDATED, refresh);
    return () => {
      socket.off(SocketEvents.STREAM_QA_CREATED, refresh);
      socket.off(SocketEvents.STREAM_QA_UPDATED, refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, streamId]);

  // Hide dismissed questions from non-hosts; keep pending/answered visible to all.
  const visible = (questions ?? []).filter((q) => isHost || q.status !== 'dismissed');

  return (
    <div className="glass-panel space-y-3 rounded-xl p-4 text-sm">
      <p className="font-medium">Q&amp;A</p>

      {user ? (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a question…"
            maxLength={500}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) submitMutation.mutate();
            }}
            className="flex-1 rounded-lg border border-outline-variant/40 bg-surface-container-high px-3 py-2"
          />
          <button
            type="button"
            disabled={submitMutation.isPending || !draft.trim()}
            onClick={() => submitMutation.mutate()}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-on-primary disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-on-surface-variant">No questions yet — be the first to ask.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((q) => (
            <li
              key={q.id}
              className={`flex items-start gap-3 rounded-lg border border-outline-variant/30 px-3 py-2 ${
                q.status === 'answered' ? 'opacity-60' : ''
              }`}
            >
              <button
                type="button"
                disabled={upvoteMutation.isPending || !user}
                onClick={() => upvoteMutation.mutate(q.id)}
                aria-pressed={q.viewerHasUpvoted}
                className={`flex shrink-0 flex-col items-center rounded-md px-2 py-1 ${
                  q.viewerHasUpvoted ? 'bg-primary/15 text-primary' : 'text-on-surface-variant'
                } disabled:opacity-50`}
              >
                <span aria-hidden>▲</span>
                <span className="text-xs font-medium">{q.upvotes}</span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="break-words">{q.body}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-on-surface-variant">
                  {q.user?.displayName || q.user?.username ? (
                    <span>{q.user.displayName ?? q.user.username}</span>
                  ) : null}
                  {q.status !== 'pending' ? (
                    <span className="rounded-full bg-surface-container-high px-2 py-0.5">
                      {STATUS_LABEL[q.status]}
                    </span>
                  ) : null}
                </div>
                {isHost ? (
                  <div className="mt-2 flex gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => statusMutation.mutate({ questionId: q.id, status: 'answered' })}
                      className="text-primary hover:underline"
                    >
                      Mark answered
                    </button>
                    <button
                      type="button"
                      onClick={() => statusMutation.mutate({ questionId: q.id, status: 'dismissed' })}
                      className="text-error hover:underline"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
