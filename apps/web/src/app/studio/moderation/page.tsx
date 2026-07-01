'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { EmptyState, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type ModeratedCommunity = {
  communityId: string;
  role: string;
  community?: {
    id: string;
    name: string;
    slug: string;
    creatorId: string;
    creator?: { username?: string; displayName?: string };
  } | null;
};

type UnifiedReport = {
  id: string;
  communityId: string;
  communityName?: string;
  targetType?: string;
  status: string;
  reason?: string;
  createdAt: string;
};

export default function StudioModerationHubPage() {
  const { user, isGuest } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['moderated-communities', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: res } = await api.get<{ data: { data: ModeratedCommunity[] } }>(
        '/creators/me/moderated-communities',
      );
      return res.data.data;
    },
  });

  const { data: inbox } = useQuery({
    queryKey: ['unified-mod-inbox', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: res } = await api.get<{ data: { data: UnifiedReport[] } }>(
        '/creators/me/moderation/inbox',
      );
      return res.data.data;
    },
  });

  if (isGuest) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8">
        <p className="text-sm text-on-surface-variant">Sign in to access moderation tools.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <PageHeader
        title="Community moderation"
        subtitle="Communities where you have moderator, admin, or coach access"
      />

      {(inbox ?? []).length > 0 ? (
        <section className="mb-8 space-y-3">
          <h2 className="font-label-caps text-sm text-outline">Unified inbox — open reports</h2>
          <ul className="space-y-2">
            {(inbox ?? []).slice(0, 20).map((r) => (
              <li
                key={r.id}
                className="glass-panel flex items-center justify-between rounded-xl px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{r.communityName ?? r.communityId}</p>
                  <p className="text-xs text-on-surface-variant">
                    {r.targetType ?? 'content'} · {r.reason ?? 'Reported'}
                  </p>
                </div>
                <Link
                  href={`/studio/moderation/${r.communityId}`}
                  className="text-xs text-primary hover:underline"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="No delegated communities"
          description="When a creator assigns you a moderation role, those communities appear here."
        />
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((row) => {
            const c = row.community;
            if (!c) return null;
            return (
              <li key={row.communityId}>
                <Link
                  href={`/studio/moderation/${c.id}`}
                  className="glass-panel flex items-center justify-between rounded-xl p-4 transition-colors hover:border-primary/30"
                >
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-sm text-on-surface-variant">
                      {c.creator?.displayName ?? c.creator?.username ?? 'Creator'}
                    </p>
                  </div>
                  <span className="text-xs capitalize text-primary">{row.role}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/studio" className="mt-8 inline-block text-sm text-primary hover:underline">
        ← Back to Studio
      </Link>
    </main>
  );
}
