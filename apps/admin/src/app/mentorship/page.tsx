'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';

type Overview = {
  counts: Record<string, number>;
  recent: Array<{
    id: string;
    communityId: string;
    communityName: string;
    mentorId: string;
    menteeId: string;
    status: string;
    matchScore: number | null;
    createdAt: string;
  }>;
};

export default function MentorshipOversightPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-mentorship-overview'],
    queryFn: async () => {
      const { data: res } = await api.get<{ data: Overview }>('/admin/mentorship/overview?limit=50');
      return res.data;
    },
  });

  const counts = data?.counts ?? {};
  const recent = data?.recent ?? [];

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 md:px-12">
      <PageHeader
        title="Mentorship oversight"
        subtitle="Match health across communities"
      />

      <div className="mt-6 flex flex-wrap gap-3">
        {Object.keys(counts).length === 0 && !isLoading ? (
          <p className="text-sm text-on-surface-variant">No mentorship matches yet.</p>
        ) : (
          Object.entries(counts).map(([status, count]) => (
            <StatusPill
              key={status}
              tone={status === 'pending' ? 'warning' : 'neutral'}
              label={`${status}: ${count}`}
            />
          ))
        )}
      </div>

      <h3 className="mt-10 text-sm font-semibold">Recent matches</h3>
      {isLoading ? (
        <p className="mt-3 text-sm text-on-surface-variant" aria-busy="true">
          Loading matches…
        </p>
      ) : recent.length === 0 ? (
        <p className="mt-3 text-sm text-on-surface-variant">No recent matches.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {recent.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border border-outline-variant/30 px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{m.communityName}</p>
                <StatusPill tone="neutral" label={m.status} />
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">
                Mentor {m.mentorId.slice(0, 8)}… · Mentee {m.menteeId.slice(0, 8)}…
                {m.matchScore != null ? ` · score ${m.matchScore}` : ''} ·{' '}
                {new Date(m.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
