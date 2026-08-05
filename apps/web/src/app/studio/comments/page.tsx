'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState, ListSkeleton, PageHeader } from '@forge/design-system';
import { ConfirmDialog } from '@forge/design-system/client';
import { getRecentCommentsOnMyVideos } from '@/lib/creator-studio';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/api-message';

export default function StudioCommentsPage() {
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [error, setError] = useState('');
  const [removeTarget, setRemoveTarget] = useState<{ videoId: string; commentId: string } | null>(
    null,
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['studio-comments', user?.id],
    queryFn: () => getRecentCommentsOnMyVideos(user?.id),
    enabled: !!user?.id && isCreator,
  });

  const replyMutation = useMutation({
    mutationFn: async ({ videoId, parentId, content }: { videoId: string; parentId: string; content: string }) => {
      await api.post(`/videos/${videoId}/comments`, { content, parentId });
    },
    onSuccess: () => {
      setReplyingTo(null);
      setReplyText('');
      setError('');
      void qc.invalidateQueries({ queryKey: ['studio-comments', user?.id] });
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not post reply.')),
  });

  const pinMutation = useMutation({
    mutationFn: async ({
      videoId,
      commentId,
      isPinned,
    }: {
      videoId: string;
      commentId: string;
      isPinned: boolean;
    }) => {
      await api.post(`/videos/${videoId}/comments/${commentId}/pin`, { isPinned });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['studio-comments', user?.id] }),
    onError: (e) => setError(getApiErrorMessage(e, 'Could not update pin.')),
  });

  const heartMutation = useMutation({
    mutationFn: async ({
      videoId,
      commentId,
      creatorHearted,
    }: {
      videoId: string;
      commentId: string;
      creatorHearted: boolean;
    }) => {
      await api.post(`/videos/${videoId}/comments/${commentId}/creator-heart`, { creatorHearted });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['studio-comments', user?.id] }),
    onError: (e) => setError(getApiErrorMessage(e, 'Could not update heart.')),
  });

  const removeMutation = useMutation({
    mutationFn: async ({ videoId, commentId }: { videoId: string; commentId: string }) => {
      await api.delete(`/videos/${videoId}/comments/${commentId}`);
    },
    onSuccess: () => {
      setRemoveTarget(null);
      setError('');
      void qc.invalidateQueries({ queryKey: ['studio-comments', user?.id] });
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not remove comment.')),
  });

  if (!isCreator) {
    return (
      <main className="space-y-4">
        <PageHeader title="Comments workspace" subtitle="Creator access required." />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Comments workspace"
          subtitle="Reply to viewer comments without leaving Studio."
        />
        <Link href="/studio/attention" className="text-sm text-primary hover:underline">
          Open attention queue
        </Link>
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}
      {isLoading && <ListSkeleton rows={4} />}
      {isError && <p className="text-error">Failed to load comments.</p>}

      {!isLoading && !isError && !data?.length && (
        <EmptyState
          icon="forum"
          title="No comments yet"
          description="When viewers comment on your videos, they will appear here."
          action={{ label: 'Upload a video', href: '/upload' }}
        />
      )}

      <ul className="space-y-3">
        {data?.map((c) => (
          <li key={c.id} className="glass-panel rounded-2xl p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-outline">
              <Link href={`/watch/${c.videoId}`} className="text-primary hover:underline">
                {c.videoTitle}
              </Link>
              <span>·</span>
              <span>{timeAgo(c.createdAt)}</span>
            </div>
            <p className="text-sm text-on-surface">{c.content}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-on-surface-variant">
                @{c.user?.username ?? 'user'} · {c.user?.displayName ?? 'User'}
              </p>
              <div className="flex gap-3 text-sm">
                <Link href={`/watch/${c.videoId}`} className="text-on-surface-variant hover:underline">
                  Open video
                </Link>
                {!c.parentId ? (
                  <button
                    type="button"
                    className="text-on-surface-variant hover:text-primary"
                    disabled={pinMutation.isPending}
                    aria-label={c.isPinned ? 'Unpin comment' : 'Pin comment'}
                    aria-pressed={!!c.isPinned}
                    onClick={() =>
                      pinMutation.mutate({
                        videoId: c.videoId,
                        commentId: c.id,
                        isPinned: !c.isPinned,
                      })
                    }
                  >
                    {c.isPinned ? 'Unpin' : 'Pin'}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={c.creatorHearted ? 'text-error' : 'text-on-surface-variant hover:text-error'}
                  disabled={heartMutation.isPending}
                  aria-label={c.creatorHearted ? 'Remove heart' : 'Heart comment'}
                  aria-pressed={!!c.creatorHearted}
                  onClick={() =>
                    heartMutation.mutate({
                      videoId: c.videoId,
                      commentId: c.id,
                      creatorHearted: !c.creatorHearted,
                    })
                  }
                >
                  {c.creatorHearted ? '♥' : '♡'}
                </button>
                <button
                  type="button"
                  className="text-error hover:underline"
                  disabled={removeMutation.isPending}
                  aria-label="Remove comment"
                  onClick={() => setRemoveTarget({ videoId: c.videoId, commentId: c.id })}
                >
                  Remove
                </button>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => {
                    setReplyingTo(replyingTo === c.id ? null : c.id);
                    setReplyText('');
                  }}
                >
                  {replyingTo === c.id ? 'Cancel' : 'Reply'}
                </button>
              </div>
            </div>

            {replyingTo === c.id ? (
              <div className="mt-4 space-y-3 border-t border-outline-variant/30 pt-4">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                  placeholder="Write a helpful reply…"
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  type="button"
                  disabled={!replyText.trim() || replyMutation.isPending}
                  onClick={() =>
                    replyMutation.mutate({
                      videoId: c.videoId,
                      parentId: c.id,
                      content: replyText.trim(),
                    })
                  }
                  className="primary-button rounded-full px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
                >
                  {replyMutation.isPending ? 'Posting…' : 'Post reply'}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove comment?"
        description="This removes the comment from your video."
        confirmLabel="Remove"
        onConfirm={() => {
          if (!removeTarget) return;
          removeMutation.mutate(removeTarget);
        }}
        onCancel={() => setRemoveTarget(null)}
        loading={removeMutation.isPending}
      />
    </main>
  );
}
