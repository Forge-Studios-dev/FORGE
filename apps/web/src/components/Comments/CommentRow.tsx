'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { Comment, User } from '@/types';
import { formatCount, timeAgo } from '@/lib/utils';
import { COMMENT_REPORT_REASONS } from '@/lib/report-reasons';
import {
  deleteComment,
  dislikeComment,
  likeComment,
  listCommentReplies,
  pinComment,
  reportComment,
  setCreatorHeart,
  undislikeComment,
  unlikeComment,
  updateComment,
} from '@/lib/comments-api';
import { Icon } from '@forge/design-system';
import { ConfirmDialog } from '@forge/design-system/client';
import { CommentBody } from './CommentBody';

export function CommentRow({
  comment,
  videoId,
  onReply,
  currentUser,
  onGuestInteract,
  onRefresh,
  isVideoOwner = false,
  depth = 0,
  onSeek,
  highlightId = null,
  autoExpandReplies = false,
}: {
  comment: Comment;
  videoId: string;
  onReply: (parentId: string, mentionUsername?: string) => void;
  currentUser?: User | null;
  onGuestInteract?: () => void;
  onRefresh: () => void;
  isVideoOwner?: boolean;
  depth?: number;
  onSeek?: (seconds: number) => void;
  highlightId?: string | null;
  autoExpandReplies?: boolean;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [confirmAction, setConfirmAction] = useState<'delete' | 'remove' | null>(null);

  useEffect(() => {
    if (!reportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReportOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reportOpen]);
  const [liked, setLiked] = useState(!!comment.viewerLiked);
  const [disliked, setDisliked] = useState(!!comment.viewerDisliked);
  const [likeCount, setLikeCount] = useState(comment.likeCount ?? 0);
  const [pinned, setPinned] = useState(!!comment.isPinned);
  const [hearted, setHearted] = useState(!!comment.creatorHearted);
  const [replyCursor, setReplyCursor] = useState<string | null>(null);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [repliesHasMore, setRepliesHasMore] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [linkHint, setLinkHint] = useState<string | null>(null);
  const autoExpandedRef = useRef(false);

  const isOwn = currentUser?.id === comment.userId;
  const isHighlighted = highlightId === comment.id;

  const loadReplies = useCallback(
    async (cursor?: string) => {
      setLoadingReplies(true);
      try {
        const page = await listCommentReplies(videoId, comment.id, {
          limit: 20,
          cursor,
        });
        setReplies((prev) => (cursor ? [...prev, ...page.data] : page.data));
        setReplyCursor(page.meta.cursor);
        setRepliesHasMore(page.meta.hasMore);
      } finally {
        setLoadingReplies(false);
      }
    },
    [comment.id, videoId],
  );

  useEffect(() => {
    if (!autoExpandReplies || depth !== 0 || autoExpandedRef.current) return;
    autoExpandedRef.current = true;
    setShowReplies(true);
    void loadReplies();
  }, [autoExpandReplies, depth, loadReplies]);

  useEffect(() => {
    if (!isHighlighted) return;
    const el = document.getElementById(`comment-${comment.id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isHighlighted, comment.id, showReplies, replies.length]);

  const copyCommentLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lc', comment.id);
      await navigator.clipboard.writeText(url.toString());
      setLinkHint('Link copied');
      window.setTimeout(() => setLinkHint(null), 2000);
    } catch {
      setLinkHint('Could not copy');
      window.setTimeout(() => setLinkHint(null), 2000);
    }
  };

  const toggleReplies = () => {
    const next = !showReplies;
    setShowReplies(next);
    if (next && replies.length === 0) void loadReplies();
  };

  const likeMut = useMutation({
    mutationFn: async (wasLiked: boolean) => {
      if (wasLiked) {
        await unlikeComment(videoId, comment.id);
      } else {
        await likeComment(videoId, comment.id);
      }
    },
    onMutate: (wasLiked) => {
      const wasDisliked = disliked;
      setLiked(!wasLiked);
      if (!wasLiked && wasDisliked) setDisliked(false);
      setLikeCount((c) => (wasLiked ? Math.max(0, c - 1) : c + 1));
    },
    onError: () => {
      setLiked(!!comment.viewerLiked);
      setDisliked(!!comment.viewerDisliked);
      setLikeCount(comment.likeCount ?? 0);
    },
  });

  const dislikeMut = useMutation({
    mutationFn: async (wasDisliked: boolean) => {
      if (wasDisliked) {
        await undislikeComment(videoId, comment.id);
      } else {
        await dislikeComment(videoId, comment.id);
      }
    },
    onMutate: (wasDisliked) => {
      const wasLiked = liked;
      setDisliked(!wasDisliked);
      if (!wasDisliked && wasLiked) {
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      }
    },
    onError: () => {
      setLiked(!!comment.viewerLiked);
      setDisliked(!!comment.viewerDisliked);
      setLikeCount(comment.likeCount ?? 0);
    },
  });

  const editMut = useMutation({
    mutationFn: async () => {
      await updateComment(videoId, comment.id, { content: editText.trim() });
    },
    onSuccess: () => {
      setEditing(false);
      onRefresh();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      await deleteComment(videoId, comment.id);
    },
    onSuccess: () => {
      setConfirmAction(null);
      onRefresh();
    },
  });

  const reportMut = useMutation({
    mutationFn: async () => {
      const reason =
        reportReason === 'Other'
          ? reportDetails.trim() || 'Other'
          : reportDetails.trim()
            ? `${reportReason}: ${reportDetails.trim()}`
            : reportReason;
      await reportComment(comment.id, {
        reason: reason.slice(0, 2000),
        ...(reportReason ? { reasonCategory: reportReason } : {}),
      });
    },
    onSuccess: () => {
      setReportOpen(false);
      setReportReason('');
      setReportDetails('');
    },
  });

  const pinMut = useMutation({
    mutationFn: async (next: boolean) => {
      await pinComment(videoId, comment.id, next);
    },
    onMutate: (next) => setPinned(next),
    onError: (_e, next) => setPinned(!next),
    onSuccess: onRefresh,
  });

  const heartMut = useMutation({
    mutationFn: async (next: boolean) => {
      await setCreatorHeart(videoId, comment.id, next);
    },
    onMutate: (next) => setHearted(next),
    onError: (_e, next) => setHearted(!next),
    onSuccess: onRefresh,
  });

  return (
    <article
      id={`comment-${comment.id}`}
      className={`flex gap-4 rounded-xl transition ${
        isHighlighted ? 'bg-primary/10 ring-1 ring-primary/40' : ''
      }`}
    >
      {!comment.isDeleted && comment.user?.avatarUrl ? (
        <Image src={comment.user.avatarUrl} alt="" width={40} height={40} className="rounded-full object-cover" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-sm font-bold text-primary">
          {comment.isDeleted ? (
            <Icon name="block" className="text-base text-on-surface-variant" />
          ) : (
            (comment.user?.displayName ?? '?')[0]
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        {comment.isDeleted ? (
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm italic text-on-surface-variant">[deleted]</span>
            <span className="font-label-caps text-[10px] text-outline">{timeAgo(comment.createdAt)}</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-2">
            {pinned ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Pinned
              </span>
            ) : null}
            {comment.user?.username ? (
              <Link
                href={`/${comment.user.username}`}
                className="text-sm font-medium text-on-surface hover:text-primary"
              >
                {comment.user.displayName ?? comment.user.username}
              </Link>
            ) : (
              <span className="text-sm font-medium text-on-surface">
                {comment.user?.displayName ?? 'User'}
              </span>
            )}
            <span className="font-label-caps text-[10px] text-outline">{timeAgo(comment.createdAt)}</span>
            {hearted ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-error" title="Hearted by creator">
                ❤ Creator
              </span>
            ) : null}
          </div>
        )}
        {!comment.isDeleted &&
          (editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => editMut.mutate()}
                  disabled={editMut.isPending || !editText.trim()}
                  className="text-xs font-semibold text-primary"
                >
                  Save
                </button>
                <button type="button" onClick={() => setEditing(false)} className="text-xs text-outline">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <CommentBody content={comment.content} onSeek={onSeek} />
          ))}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          {!comment.isDeleted && (
            <>
              <button
                type="button"
                aria-label={liked ? `Unlike comment, ${likeCount} likes` : `Like comment, ${likeCount} likes`}
                aria-pressed={liked}
                disabled={likeMut.isPending || dislikeMut.isPending}
                onClick={() => {
                  if (!currentUser) {
                    onGuestInteract?.();
                    return;
                  }
                  likeMut.mutate(liked);
                }}
                className={`inline-flex items-center gap-1 font-semibold ${liked ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
              >
                <Icon name="thumb_up" filled={liked} className="text-sm" />
                {likeCount > 0 ? formatCount(likeCount) : 'Like'}
              </button>
              <button
                type="button"
                aria-label={disliked ? 'Remove dislike' : 'Dislike comment'}
                aria-pressed={disliked}
                disabled={likeMut.isPending || dislikeMut.isPending}
                onClick={() => {
                  if (!currentUser) {
                    onGuestInteract?.();
                    return;
                  }
                  dislikeMut.mutate(disliked);
                }}
                className={`inline-flex items-center font-semibold ${disliked ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
              >
                <Icon name="thumb_down" filled={disliked} className="text-sm" />
              </button>
            </>
          )}
          {depth === 0 && (comment.replyCount ?? 0) > 0 ? (
            <button
              type="button"
              onClick={toggleReplies}
              className="font-semibold text-primary hover:underline"
              aria-expanded={showReplies}
            >
              {showReplies
                ? 'Hide replies'
                : `${formatCount(comment.replyCount!)} ${comment.replyCount === 1 ? 'reply' : 'replies'}`}
            </button>
          ) : null}
          {!comment.isDeleted && depth === 0 && (
            <button
              type="button"
              onClick={() => {
                if (!showReplies && (comment.replyCount ?? 0) > 0) {
                  setShowReplies(true);
                  if (replies.length === 0) void loadReplies();
                }
                onReply(comment.id, comment.user?.username);
              }}
              className="font-semibold text-on-surface-variant hover:text-primary"
            >
              Reply
            </button>
          )}
          {!comment.isDeleted && isOwn && !editing && (
            <>
              <button type="button" onClick={() => setEditing(true)} className="text-on-surface-variant hover:text-primary">
                Edit
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction('delete')}
                className="text-error hover:underline"
              >
                Delete
              </button>
            </>
          )}
          {!comment.isDeleted && isVideoOwner && !isOwn && (
            <button
              type="button"
              onClick={() => setConfirmAction('remove')}
              className="text-error hover:underline"
              aria-label="Remove comment"
            >
              Remove
            </button>
          )}
          {!comment.isDeleted && isVideoOwner && depth === 0 && (
            <button
              type="button"
              disabled={pinMut.isPending}
              onClick={() => pinMut.mutate(!pinned)}
              className="text-on-surface-variant hover:text-primary"
              aria-label={pinned ? 'Unpin comment' : 'Pin comment'}
              aria-pressed={pinned}
            >
              {pinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          {!comment.isDeleted && isVideoOwner && (
            <button
              type="button"
              disabled={heartMut.isPending}
              onClick={() => heartMut.mutate(!hearted)}
              className={`inline-flex items-center gap-0.5 ${hearted ? 'text-error' : 'text-on-surface-variant hover:text-error'}`}
              aria-pressed={hearted}
              aria-label={hearted ? 'Remove heart' : 'Heart comment'}
              title={hearted ? 'Remove heart' : 'Heart'}
            >
              <Icon name="favorite" filled={hearted} className="text-sm" />
            </button>
          )}
          {!comment.isDeleted && !isOwn && currentUser && (
            <button type="button" onClick={() => setReportOpen(true)} className="text-on-surface-variant hover:text-primary">
              Report
            </button>
          )}
          {!comment.isDeleted && (
            <button
              type="button"
              onClick={() => void copyCommentLink()}
              className="text-on-surface-variant hover:text-primary"
            >
              {linkHint ?? 'Copy link'}
            </button>
          )}
        </div>
        {showReplies && (
          <div className="mt-4 space-y-4 border-l border-outline-variant/30 pl-4">
            {replies.map((r) => (
              <CommentRow
                key={r.id}
                comment={r}
                videoId={videoId}
                onReply={onReply}
                currentUser={currentUser}
                onGuestInteract={onGuestInteract}
                onRefresh={onRefresh}
                isVideoOwner={isVideoOwner}
                depth={1}
                onSeek={onSeek}
                highlightId={highlightId}
              />
            ))}
            {repliesHasMore && (
              <button
                type="button"
                onClick={() => void loadReplies(replyCursor ?? undefined)}
                disabled={loadingReplies}
                className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              >
                {loadingReplies ? 'Loading…' : 'Load more replies'}
              </button>
            )}
          </div>
        )}
      </div>
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`comment-report-title-${comment.id}`}
          onClick={() => setReportOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={`comment-report-title-${comment.id}`} className="font-semibold">
              Report comment
            </h3>
            <fieldset className="mt-3 space-y-2">
              <legend className="sr-only">Reason</legend>
              {COMMENT_REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                    reportReason === r
                      ? 'border-primary bg-primary/10'
                      : 'border-outline-variant/40 text-on-surface-variant'
                  }`}
                >
                  <input
                    type="radio"
                    name={`comment-report-${comment.id}`}
                    value={r}
                    checked={reportReason === r}
                    onChange={() => setReportReason(r)}
                  />
                  {r}
                </label>
              ))}
            </fieldset>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder={
                reportReason === 'Other' ? 'Describe the issue (required)…' : 'Optional details…'
              }
              rows={3}
              className="mt-3 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setReportOpen(false)} className="px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !reportReason ||
                  (reportReason === 'Other' && reportDetails.trim().length < 3) ||
                  reportMut.isPending
                }
                onClick={() => reportMut.mutate()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmAction === 'delete'}
        title="Delete comment?"
        description="This permanently removes your comment."
        confirmLabel="Delete"
        onConfirm={() => deleteMut.mutate()}
        onCancel={() => setConfirmAction(null)}
        loading={deleteMut.isPending}
      />
      <ConfirmDialog
        open={confirmAction === 'remove'}
        title="Remove comment?"
        description="This removes the comment from your video."
        confirmLabel="Remove"
        onConfirm={() => deleteMut.mutate()}
        onCancel={() => setConfirmAction(null)}
        loading={deleteMut.isPending}
      />
    </article>
  );
}
