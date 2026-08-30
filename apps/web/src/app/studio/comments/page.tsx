'use client';

import Link from 'next/link';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button, EmptyState, Icon, Input, ListSkeleton, PageHeader } from '@forge/design-system';
import { ConfirmDialog } from '@forge/design-system/client';
import { fetchStudioComments, type StudioCommentFilter } from '@/lib/creator-studio';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/api-message';

/** Comments open on watch with `?lc=` highlight (including Shorts). */
function studioCommentWatchHref(videoId: string, commentId: string): string {
  return `/watch/${videoId}?lc=${encodeURIComponent(commentId)}`;
}

const FILTERS: { id: StudioCommentFilter; label: string }[] = [
  { id: 'all', label: 'Published' },
  { id: 'held', label: 'Held for review' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'hearted', label: 'Hearted' },
];

function parseCommentFilter(raw: string | null): StudioCommentFilter {
  if (raw === 'held' || raw === 'pinned' || raw === 'hearted' || raw === 'all') return raw;
  return 'all';
}

export default function StudioCommentsPage() {
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');
  const qParam = searchParams.get('q') ?? '';
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState(() => (qParam.trim().length >= 2 ? qParam.trim() : ''));
  const [debouncedQuery, setDebouncedQuery] = useState(() =>
    qParam.trim().length >= 2 ? qParam.trim() : '',
  );
  const [filter, setFilter] = useState<StudioCommentFilter>(() => parseCommentFilter(filterParam));
  const [removeTarget, setRemoveTarget] = useState<{ videoId: string; commentId: string } | null>(
    null,
  );
  const [linkHintId, setLinkHintId] = useState<string | null>(null);

  useEffect(() => {
    setFilter(parseCommentFilter(filterParam));
  }, [filterParam]);

  useEffect(() => {
    const fromUrl = qParam.trim().length >= 2 ? qParam.trim() : '';
    setQuery(fromUrl);
    setDebouncedQuery(fromUrl);
  }, [qParam]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = query.trim();
      setDebouncedQuery(next.length >= 2 ? next : '');
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const current = qParam.trim().length >= 2 ? qParam.trim() : '';
    if (debouncedQuery === current) return;
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedQuery) params.set('q', debouncedQuery);
    else params.delete('q');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedQuery, pathname, qParam, router, searchParams]);

  const applyFilter = (next: StudioCommentFilter) => {
    setFilter(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'all') params.delete('filter');
    else params.set('filter', next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const searchQ = debouncedQuery.length >= 2 ? debouncedQuery : undefined;

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['studio-comments', user?.id, filter, searchQ ?? ''],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchStudioComments({
        filter,
        q: searchQ,
        limit: 40,
        cursor: pageParam,
      }),
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
    enabled: !!user?.id && isCreator,
  });

  const comments = data?.pages.flatMap((p) => p.items) ?? [];

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ['studio-comments', user?.id] });

  const replyMutation = useMutation({
    mutationFn: async ({
      videoId,
      parentId,
      content,
    }: {
      videoId: string;
      parentId: string;
      content: string;
    }) => {
      await api.post(`/videos/${videoId}/comments`, { content, parentId });
    },
    onSuccess: () => {
      setReplyingTo(null);
      setReplyText('');
      setError('');
      invalidate();
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
    onSuccess: invalidate,
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
    onSuccess: invalidate,
    onError: (e) => setError(getApiErrorMessage(e, 'Could not update heart.')),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ videoId, commentId }: { videoId: string; commentId: string }) => {
      await api.post(`/videos/${videoId}/comments/${commentId}/approve`);
    },
    onSuccess: () => {
      setError('');
      invalidate();
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not release comment.')),
  });

  const removeMutation = useMutation({
    mutationFn: async ({ videoId, commentId }: { videoId: string; commentId: string }) => {
      await api.delete(`/videos/${videoId}/comments/${commentId}`);
    },
    onSuccess: () => {
      setRemoveTarget(null);
      setError('');
      invalidate();
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not remove comment.')),
  });

  const copyCommentLink = async (videoId: string, commentId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const path = studioCommentWatchHref(videoId, commentId);
    try {
      await navigator.clipboard.writeText(`${origin}${path}`);
      setLinkHintId(commentId);
      window.setTimeout(() => setLinkHintId(null), 2000);
    } catch {
      setError('Could not copy comment link.');
    }
  };

  if (!isCreator) {
    return (
      <main className="space-y-4">
        <PageHeader title="Comments workspace" subtitle="Creator access required." />
      </main>
    );
  }

  const emptyInbox =
    !isLoading && !isError && !comments.length && !searchQ && filter === 'all';

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
      {isError ? (
        <div className="space-y-2">
          <p className="text-error">Failed to load comments.</p>
          <button
            type="button"
            className="text-sm font-semibold text-primary hover:underline"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      ) : null}

      {!isLoading && !isError ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-[200px] flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search comments"
              aria-label="Search comments"
              className="pl-10"
            />
          </div>
          <div role="tablist" aria-label="Comment filters" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => applyFilter(f.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  filter === f.id
                    ? 'bg-on-surface text-surface'
                    : 'border border-outline-variant/40 text-on-surface-variant hover:border-primary'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {emptyInbox ? (
        <EmptyState
          icon="forum"
          title="No comments yet"
          description="When viewers comment on your videos, they will appear here."
          action={{ label: 'Upload a video', href: '/upload' }}
        />
      ) : null}

      {!isLoading && !isError && !comments.length && !!searchQ ? (
        <EmptyState
          icon="search_off"
          title="No matching comments"
          description={`Nothing matched “${searchQ}”.`}
          action={{ label: 'Clear search', href: '/studio/comments' }}
          onAction={() => setQuery('')}
        />
      ) : null}

      {!isLoading && !isError && !comments.length && !searchQ && filter !== 'all' ? (
        <EmptyState
          icon="search_off"
          title="No matching comments"
          description="No comments in this filter."
          action={{ label: 'Clear filters', href: '/studio/comments' }}
          onAction={() => applyFilter('all')}
        />
      ) : null}

      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="glass-panel rounded-2xl p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-outline">
              {c.moderationStatus === 'held' ? (
                <span className="rounded-full bg-error/10 px-2 py-0.5 font-medium text-error">
                  Held for review
                </span>
              ) : null}
              {c.isPinned ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                  Pinned
                </span>
              ) : null}
              {c.videoType === 'short' ? (
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-semibold uppercase tracking-wide text-on-surface-variant">
                  Short
                </span>
              ) : null}
              <Link
                href={studioCommentWatchHref(c.videoId, c.id)}
                className="text-primary hover:underline"
              >
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
                {c.moderationStatus === 'held' ? (
                  <button
                    type="button"
                    className="font-semibold text-primary hover:underline"
                    disabled={approveMutation.isPending}
                    onClick={() =>
                      approveMutation.mutate({ videoId: c.videoId, commentId: c.id })
                    }
                  >
                    Release
                  </button>
                ) : null}
                <Link
                  href={studioCommentWatchHref(c.videoId, c.id)}
                  className="text-on-surface-variant hover:underline"
                >
                  View comment
                </Link>
                <button
                  type="button"
                  className="text-on-surface-variant hover:text-primary"
                  onClick={() => void copyCommentLink(c.videoId, c.id)}
                >
                  {linkHintId === c.id ? 'Copied' : 'Copy link'}
                </button>
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
                  className={
                    c.creatorHearted ? 'text-error' : 'text-on-surface-variant hover:text-error'
                  }
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
                <Button
                  type="button"
                  variant="primary"
                  disabled={!replyText.trim() || replyMutation.isPending}
                  onClick={() =>
                    replyMutation.mutate({
                      videoId: c.videoId,
                      parentId: c.id,
                      content: replyText.trim(),
                    })
                  }
                  className="px-4 py-2"
                >
                  {replyMutation.isPending ? 'Posting…' : 'Post reply'}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {hasNextPage ? (
        <button
          type="button"
          className="text-sm font-semibold text-primary hover:underline"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      ) : null}

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
