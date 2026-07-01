'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { EmptyState, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type UpdatePost = {
  id: string;
  communityId: string;
  community: { id: string; name: string; slug: string; creatorId: string } | null;
  author: { displayName?: string; username?: string } | null;
  title: string | null;
  body: string;
  mediaUrls: string[];
  createdAt: string;
  commentCount: number;
  likeCount: number;
  likedByMe: boolean;
};

export default function CommunityUpdatesPage() {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['community-updates', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: res } = await api.get<{ data: UpdatePost[] }>('/me/community-updates');
      return res.data ?? [];
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 md:px-12">
      <PageHeader
        title="Updates"
        subtitle="Announcements from communities you've joined"
      />

      {isLoading && <p className="text-sm text-on-surface-variant">Loading updates…</p>}
      {isError && <p className="text-error">Failed to load updates.</p>}

      {!isLoading && !isError && (data?.length ?? 0) === 0 && (
        <EmptyState
          icon="campaign"
          title="No updates yet"
          description="Join creator communities to see their announcements here."
          action={{ label: 'Discover communities', href: '/discover/communities' }}
        />
      )}

      <ul className="space-y-4">
        {(data ?? []).map((post) => (
          <li key={post.id} className="glass-panel rounded-xl p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Link
                href={`/community/${post.communityId}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {post.community?.name ?? 'Community'}
              </Link>
              <time className="text-xs text-on-surface-variant">
                {new Date(post.createdAt).toLocaleDateString()}
              </time>
            </div>
            {post.title ? (
              <h2 className="font-display-forge mb-1 text-lg font-bold">{post.title}</h2>
            ) : null}
            <p className="whitespace-pre-wrap text-sm text-on-surface">{post.body}</p>
            <div className="mt-3 flex gap-4 text-xs text-on-surface-variant">
              <span>{post.likeCount} likes</span>
              <span>{post.commentCount} comments</span>
              {post.author?.displayName || post.author?.username ? (
                <span>by {post.author.displayName ?? post.author.username}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
