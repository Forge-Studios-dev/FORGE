'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { EmptyState, Icon } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';
import { timeAgo } from '@/lib/utils';
import { AuthGateModal } from '@/components/gates/AuthGateModal';

type ChannelPost = {
  id: string;
  communityId: string;
  community: { id: string; name: string; slug: string } | null;
  author: { displayName: string; username: string } | null;
  title: string | null;
  body: string;
  postType: string;
  isPinned: boolean;
  mediaUrls: string[];
  createdAt: string;
  commentCount: number;
  likeCount: number;
  likedByMe?: boolean;
};

type Props = {
  creatorId: string;
  username: string;
};

const MAX_IMAGES = 4;

async function uploadChannelPostImage(file: File): Promise<string> {
  const contentType = file.type || 'image/jpeg';
  const { data } = await api.post<{
    data: { uploadUrl: string; publicUrl: string };
  }>(`/creators/me/channel-posts/media-upload-url?contentType=${encodeURIComponent(contentType)}`);
  const { uploadUrl, publicUrl } = data.data;
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
    mode: 'cors',
    credentials: 'omit',
  });
  if (!put.ok) {
    throw new Error(`Image upload failed (HTTP ${put.status})`);
  }
  return publicUrl;
}

export function ChannelCommunityFeed({ creatorId, username }: Props) {
  const { user: me, isGuest, isCreator } = useAuth();
  const qc = useQueryClient();
  const isOwner = !!me?.id && me.id === creatorId;
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [composeError, setComposeError] = useState('');
  const [guestGate, setGuestGate] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [guestGateMessage, setGuestGateMessage] = useState('Sign in to like community posts.');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['channel-posts', creatorId],
    queryFn: async () => {
      const { data: res } = await api.get<{
        data: { data: ChannelPost[]; meta: { cursor: string | null; hasMore: boolean } };
      }>(`/creators/${creatorId}/channel-posts?limit=20`);
      return res.data;
    },
  });

  const compose = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if (text.length < 1 && mediaUrls.length === 0) {
        throw new Error('Write something or add an image to post.');
      }
      await api.post('/creators/me/channel-posts', {
        body: text,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      });
    },
    onSuccess: () => {
      setBody('');
      setMediaUrls([]);
      setComposeError('');
      void qc.invalidateQueries({ queryKey: ['channel-posts', creatorId] });
    },
    onError: (err) => {
      setComposeError(getApiErrorMessage(err, 'Could not publish post.'));
    },
  });

  const like = useMutation({
    mutationFn: async (post: ChannelPost) => {
      if (isGuest) {
        setGuestGateMessage('Sign in to like community posts.');
        setGuestGate(true);
        return;
      }
      await api.post(`/communities/${post.communityId}/posts/${post.id}/reactions`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['channel-posts', creatorId] });
    },
  });

  const expandedCommunityId =
    (data?.data ?? []).find((p) => p.id === expandedPostId)?.communityId ?? null;

  const { data: postComments } = useQuery({
    queryKey: ['channel-post-comments', expandedCommunityId, expandedPostId],
    enabled: !!expandedCommunityId && !!expandedPostId,
    queryFn: async () => {
      const { data: res } = await api.get<{
        data: {
          data: Array<{
            id: string;
            body: string;
            parentId?: string | null;
            author?: { displayName?: string };
          }>;
        };
      }>(`/communities/${expandedCommunityId}/posts/${expandedPostId}/comments`);
      return res.data.data;
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({
      communityId,
      postId,
      body: text,
      parentId,
    }: {
      communityId: string;
      postId: string;
      body: string;
      parentId?: string;
    }) => {
      await api.post(`/communities/${communityId}/posts/${postId}/comments`, {
        body: text,
        parentId,
      });
    },
    onSuccess: (_result, vars) => {
      setCommentDraft('');
      setReplyToCommentId(null);
      void qc.invalidateQueries({
        queryKey: ['channel-post-comments', vars.communityId, vars.postId],
      });
      void qc.invalidateQueries({ queryKey: ['channel-posts', creatorId] });
    },
  });

  async function onPickImages(files: FileList | null) {
    if (!files?.length) return;
    setComposeError('');
    setUploading(true);
    try {
      const remaining = MAX_IMAGES - mediaUrls.length;
      const chosen = Array.from(files)
        .filter((f) => f.type.startsWith('image/'))
        .slice(0, remaining);
      const uploaded: string[] = [];
      for (const file of chosen) {
        uploaded.push(await uploadChannelPostImage(file));
      }
      setMediaUrls((prev) => [...prev, ...uploaded].slice(0, MAX_IMAGES));
    } catch (err) {
      setComposeError(getApiErrorMessage(err, 'Could not upload image.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const posts = data?.data ?? [];
  const canPost = body.trim().length > 0 || mediaUrls.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {isOwner && isCreator ? (
        <div className="glass-panel space-y-3 rounded-2xl p-5">
          <label className="block">
            <span className="font-label-caps text-xs text-outline">Create a post</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Share an update with your subscribers…"
              className="mt-2 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface"
            />
          </label>
          {mediaUrls.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {mediaUrls.map((url) => (
                <div key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-24 w-full rounded-lg object-cover" />
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={() => setMediaUrls((prev) => prev.filter((u) => u !== url))}
                    className="absolute right-1 top-1 rounded-full bg-surface/90 px-1.5 text-xs text-on-surface"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {composeError ? (
            <p className="text-sm text-error" role="alert">
              {composeError}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => void onPickImages(e.target.files)}
            />
            <button
              type="button"
              disabled={uploading || mediaUrls.length >= MAX_IMAGES}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface disabled:opacity-50"
            >
              <Icon name="image" className="text-sm" />
              {uploading ? 'Uploading…' : 'Add image'}
            </button>
            <button
              type="button"
              disabled={compose.isPending || uploading || !canPost}
              onClick={() => compose.mutate()}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              {compose.isPending ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading community posts…</p>
      ) : isError ? (
        <EmptyState title="Couldn’t load posts" description="Try again in a moment." />
      ) : posts.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            title="No community posts yet"
            description={
              isOwner
                ? 'Share your first update above.'
                : 'When this channel posts updates, they show up here.'
            }
          />
          <Link
            href={`/${username}/community`}
            className="inline-flex text-sm font-semibold text-primary hover:underline"
          >
            Open community space
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.id} className="glass-panel rounded-2xl p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-outline">
                  {post.isPinned ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                      Pinned
                    </span>
                  ) : null}
                  <span>{post.author?.displayName ?? 'Channel'}</span>
                  <span>·</span>
                  <span>{timeAgo(post.createdAt)}</span>
                  {post.community ? (
                    <>
                      <span>·</span>
                      <Link
                        href={`/${username}/c/${post.community.slug}`}
                        className="hover:text-primary hover:underline"
                      >
                        {post.community.name}
                      </Link>
                    </>
                  ) : null}
                </div>
                {post.title ? (
                  <h3 className="mb-1 text-base font-semibold text-on-surface">{post.title}</h3>
                ) : null}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
                  {post.body}
                </p>
                {post.mediaUrls.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {post.mediaUrls.slice(0, 4).map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={url}
                        alt=""
                        className="max-h-48 w-full rounded-lg object-cover"
                      />
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={like.isPending}
                    onClick={() => like.mutate(post)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      post.likedByMe
                        ? 'bg-primary/10 text-primary'
                        : 'text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                    aria-pressed={!!post.likedByMe}
                  >
                    <Icon name="thumb_up" filled={!!post.likedByMe} className="text-sm" />
                    {post.likeCount}
                  </button>
                  <button
                    type="button"
                    aria-label={`Toggle comments, ${post.commentCount} comments`}
                    aria-expanded={expandedPostId === post.id}
                    onClick={() => {
                      setExpandedPostId((cur) => (cur === post.id ? null : post.id));
                      setReplyToCommentId(null);
                      setCommentDraft('');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high"
                  >
                    <Icon name="chat_bubble" className="text-sm" />
                    {post.commentCount} comments
                  </button>
                </div>
                {expandedPostId === post.id ? (
                  <div className="mt-3 space-y-2 rounded-xl bg-surface-container-low p-3">
                    {(postComments ?? []).length === 0 ? (
                      <p className="text-xs text-on-surface-variant">No comments yet.</p>
                    ) : (
                      (postComments ?? []).map((c) => {
                        const isReply = !!c.parentId;
                        return (
                          <div
                            key={c.id}
                            className="text-sm"
                            style={{ paddingLeft: isReply ? 16 : undefined }}
                          >
                            <span className="font-medium">{c.author?.displayName ?? 'Member'}</span>
                            {isReply ? (
                              <span className="text-xs text-outline"> · reply</span>
                            ) : null}
                            <span className="text-on-surface-variant"> — {c.body}</span>
                            {!isGuest ? (
                              <button
                                type="button"
                                className="ml-2 text-xs text-primary"
                                onClick={() => setReplyToCommentId(c.id)}
                              >
                                Reply
                              </button>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                    <form
                      className="flex flex-col gap-2 pt-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (isGuest) {
                          setGuestGateMessage('Sign in to comment on community posts.');
                          setGuestGate(true);
                          return;
                        }
                        const text = commentDraft.trim();
                        if (!text) return;
                        commentMutation.mutate({
                          communityId: post.communityId,
                          postId: post.id,
                          body: text,
                          parentId: replyToCommentId ?? undefined,
                        });
                      }}
                    >
                      {replyToCommentId ? (
                        <p className="text-xs text-on-surface-variant">
                          Replying
                          <button
                            type="button"
                            className="ml-2 text-primary"
                            onClick={() => setReplyToCommentId(null)}
                          >
                            Cancel
                          </button>
                        </p>
                      ) : null}
                      <div className="flex gap-2">
                        <input
                          value={commentDraft}
                          onChange={(e) => setCommentDraft(e.target.value)}
                          placeholder={
                            isGuest
                              ? 'Sign in to comment'
                              : replyToCommentId
                                ? 'Write a reply…'
                                : 'Add a comment…'
                          }
                          disabled={isGuest || commentMutation.isPending}
                          className="flex-1 rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                        <button
                          type="submit"
                          disabled={isGuest || commentMutation.isPending || !commentDraft.trim()}
                          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-on-primary disabled:opacity-50"
                        >
                          Post
                        </button>
                      </div>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <Link
            href={`/${username}/community`}
            className="inline-flex text-sm font-semibold text-primary hover:underline"
          >
            Open full community
          </Link>
        </>
      )}

      <AuthGateModal
        open={guestGate}
        onClose={() => setGuestGate(false)}
        message={guestGateMessage}
      />
    </div>
  );
}
