'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { EmptyState, Icon, ListSkeleton, PageHeader, StatusPill, type StatusTone } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';
import { SkillFeatureGate } from '@/components/SkillFeatureGate';

type Community = { id: string; name: string; slug: string };
type Mentor = {
  id: string;
  userId?: string;
  role?: string;
  skills?: string[];
  bio?: string | null;
  maxMentees?: number;
  currentMentees?: number;
  user?: { username?: string; displayName?: string } | null;
};
type MentorshipMatch = {
  id: string;
  status: string;
  matchScore?: number;
  mentor?: { username?: string; displayName?: string } | null;
  mentee?: { username?: string; displayName?: string } | null;
};

function matchTone(status: string): StatusTone {
  if (status === 'active' || status === 'accepted') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'declined') return 'critical';
  return 'neutral';
}

export default function StudioMentorshipPage() {
  return (
    <SkillFeatureGate feature="mentorship">
      <StudioMentorshipPageInner />
    </SkillFeatureGate>
  );
}

function StudioMentorshipPageInner() {
  const { user, isCreator } = useAuth();
  const qc = useQueryClient();
  const [communityId, setCommunityId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { data: communities } = useQuery({
    queryKey: ['studio-communities', user?.id],
    enabled: isCreator && !!user?.id,
    queryFn: async () => {
      const { data } = await api.get<{ data: Community[] }>(`/creators/${user!.id}/communities`);
      return data.data;
    },
  });

  useEffect(() => {
    if (!communityId && communities?.length) setCommunityId(communities[0].id);
  }, [communities, communityId]);

  const { data: mentors, isLoading } = useQuery({
    queryKey: ['studio-mentors', communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data } = await api.get<{ data: Mentor[] | { data: Mentor[] } }>(
        `/communities/${communityId}/mentorship/mentors`,
      );
      const payload = data.data;
      return Array.isArray(payload) ? payload : payload?.data ?? [];
    },
  });

  const { data: matches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ['studio-mentorship-matches', communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data } = await api.get<{ data: MentorshipMatch[] | { data: MentorshipMatch[] } }>(
        `/communities/${communityId}/mentorship/matches`,
      );
      const payload = data.data;
      return Array.isArray(payload) ? payload : payload?.data ?? [];
    },
  });

  const matchMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: { matched?: number } }>(
        `/communities/${communityId}/mentorship/run-matching`,
      );
      return data.data;
    },
    onSuccess: (result) => {
      setError('');
      setMessage(
        typeof result?.matched === 'number'
          ? `Matching complete — ${result.matched} new pair${result.matched === 1 ? '' : 's'} created.`
          : 'Matching run completed. Mentors and mentees will see updated matches.',
      );
      void qc.invalidateQueries({ queryKey: ['studio-mentors', communityId] });
      void qc.invalidateQueries({ queryKey: ['studio-mentorship-matches', communityId] });
    },
    onError: (e) => {
      setMessage('');
      setError(getApiErrorMessage(e, 'Could not run mentorship matching.'));
    },
  });

  if (!isCreator) {
    return (
      <main className="space-y-4">
        <PageHeader title="Mentorship" subtitle="Creator access required." />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Mentorship hub"
        subtitle="Review mentors in your community and run matching when your pool is ready."
      />

      <label className="block max-w-md text-sm">
        <span className="text-on-surface-variant">Community</span>
        <select
          value={communityId}
          onChange={(e) => setCommunityId(e.target.value)}
          className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5"
        >
          {(communities ?? []).length === 0 ? <option value="">No communities yet</option> : null}
          {(communities ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {!communityId ? (
        <EmptyState
          icon="school"
          title="Create a community first"
          description="Mentorship matching is community-scoped. Set up a community, invite mentors, then run matching here."
          action={{ label: 'Open Community', href: '/studio/community' }}
        />
      ) : (
        <>
          <section className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6">
            <div>
              <p className="font-label-caps text-xs text-outline">Matching</p>
              <h2 className="mt-1 text-lg font-semibold">Run mentor ↔ mentee matching</h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Uses current mentor capacity and mentee goals for this community.
              </p>
            </div>
            <button
              type="button"
              disabled={matchMutation.isPending}
              onClick={() => matchMutation.mutate()}
              className="primary-button inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              <Icon name="auto_awesome" />
              {matchMutation.isPending ? 'Running…' : 'Run matching'}
            </button>
          </section>

          {error ? <p className="text-sm text-error">{error}</p> : null}
          {message ? <p className="text-sm text-secondary">{message}</p> : null}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Active mentors</h2>
            {isLoading ? <ListSkeleton rows={4} /> : null}
            {!isLoading && !(mentors?.length ?? 0) ? (
              <EmptyState
                icon="group"
                title="No mentors yet"
                description="Members can create mentorship profiles inside the community. Once mentors exist, you can run matching."
              />
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              {(mentors ?? []).map((mentor) => (
                <article key={mentor.id} className="glass-panel rounded-2xl p-5">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="font-semibold">
                      {mentor.user?.displayName ||
                        mentor.user?.username ||
                        `Mentor ${mentor.userId?.slice(0, 8) ?? mentor.id.slice(0, 8)}`}
                    </h3>
                    <StatusPill tone="primary" label={mentor.role ?? 'mentor'} />
                  </div>
                  {mentor.bio ? (
                    <p className="text-sm text-on-surface-variant">{mentor.bio}</p>
                  ) : null}
                  {(mentor.skills?.length ?? 0) > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {mentor.skills!.map((skill) => (
                        <span
                          key={skill}
                          className="font-label-caps rounded-full border border-outline-variant/40 px-2 py-0.5 text-[10px] text-on-surface-variant"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {mentor.maxMentees != null ? (
                    <p className="mt-3 text-xs text-outline">
                      Capacity: {mentor.currentMentees ?? 0}/{mentor.maxMentees} mentees
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Recent matches</h2>
            {matchesLoading ? <ListSkeleton rows={3} /> : null}
            {!matchesLoading && !matches.length ? (
              <p className="text-sm text-on-surface-variant">
                No matches yet. Run matching after mentors and mentees have profiles.
              </p>
            ) : null}
            <ul className="space-y-2">
              {matches.slice(0, 20).map((match) => (
                <li
                  key={match.id}
                  className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {match.mentor?.displayName || match.mentor?.username || 'Mentor'}
                      {' → '}
                      {match.mentee?.displayName || match.mentee?.username || 'Mentee'}
                    </p>
                    {match.matchScore != null ? (
                      <p className="text-xs text-outline">Score {match.matchScore}</p>
                    ) : null}
                  </div>
                  <StatusPill tone={matchTone(match.status)} label={match.status} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
