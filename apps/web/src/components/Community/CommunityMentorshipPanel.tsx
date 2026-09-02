'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, EmptyState, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';

type Mentor = {
  id: string;
  userId?: string;
  skills?: string[];
  bio?: string | null;
  maxMentees?: number;
  currentMentees?: number;
  hasCapacity?: boolean;
  user?: { username?: string; displayName?: string } | null;
};

type MentorshipMatch = {
  id: string;
  status: string;
  mentorId?: string;
  menteeId?: string;
  matchScore?: number | null;
};

type MentorshipProfile = {
  id: string;
  role: 'mentor' | 'mentee';
  skills?: string[];
  goals?: string | null;
  bio?: string | null;
  status?: string;
} | null;

function unwrapList<T>(payload: T[] | { data?: T[] } | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export function CommunityMentorshipPanel({ communityId }: { communityId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [role, setRole] = useState<'mentor' | 'mentee'>('mentee');
  const [skills, setSkills] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['community-mentorship-profile', communityId],
    enabled: !!user && !!communityId,
    queryFn: async () => {
      const { data } = await api.get<{ data: MentorshipProfile }>(
        `/communities/${communityId}/mentorship/profile/me`,
      );
      return data.data ?? null;
    },
  });

  const { data: mentors = [], isLoading: mentorsLoading } = useQuery({
    queryKey: ['community-mentors', communityId],
    enabled: !!communityId,
    queryFn: async () => {
      const { data } = await api.get<{ data: Mentor[] | { data: Mentor[] } }>(
        `/communities/${communityId}/mentorship/mentors`,
      );
      return unwrapList(data.data);
    },
  });

  const { data: myMatches, isLoading: matchesLoading } = useQuery({
    queryKey: ['community-mentorship-matches-me', communityId],
    enabled: !!user && !!communityId,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { asMentor?: MentorshipMatch[]; asMentee?: MentorshipMatch[] };
      }>(`/communities/${communityId}/mentorship/matches/me`);
      return data.data ?? { asMentor: [], asMentee: [] };
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      await api.put(`/communities/${communityId}/mentorship/profile`, {
        role,
        skills: skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        bio: bio.trim() || undefined,
      });
    },
    onSuccess: () => {
      setError('');
      setMessage('Profile saved. Matching runs when the creator pairs mentors and mentees.');
      void qc.invalidateQueries({ queryKey: ['community-mentorship-profile', communityId] });
    },
    onError: (e) => {
      setMessage('');
      setError(getApiErrorMessage(e, 'Could not save mentorship profile.'));
    },
  });

  const respond = useMutation({
    mutationFn: async ({ matchId, accept }: { matchId: string; accept: boolean }) => {
      await api.post(`/communities/${communityId}/mentorship/matches/${matchId}/respond`, {
        accept,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['community-mentorship-matches-me', communityId] });
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not update match.')),
  });

  if (!user) {
    return (
      <EmptyState
        title="Sign in for mentorship"
        description="Join as a mentor or mentee and respond to matches in this community."
        action={{ label: 'Sign in', href: '/login' }}
      />
    );
  }

  const asMentor = myMatches?.asMentor ?? [];
  const asMentee = myMatches?.asMentee ?? [];

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-error">{error}</p> : null}
      {message ? <p className="text-sm text-secondary">{message}</p> : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Your profile</h3>
        {profileLoading ? (
          <p className="text-sm text-on-surface-variant">Loading…</p>
        ) : profile ? (
          <div className="rounded-lg border border-outline-variant/30 px-3 py-2 text-sm">
            <StatusPill tone="neutral" label={profile.role} />
            {profile.skills?.length ? (
              <p className="mt-2 text-on-surface-variant">Skills: {profile.skills.join(', ')}</p>
            ) : null}
            {profile.bio ? <p className="mt-1 text-on-surface-variant">{profile.bio}</p> : null}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={role === 'mentee' ? 'primary' : 'outline'}
                className="text-sm"
                onClick={() => setRole('mentee')}
              >
                I want a mentor
              </Button>
              <Button
                variant={role === 'mentor' ? 'primary' : 'outline'}
                className="text-sm"
                onClick={() => setRole('mentor')}
              >
                I can mentor
              </Button>
            </div>
            <input
              className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm"
              placeholder="Skills (comma-separated)"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
            <textarea
              className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm"
              placeholder="Short bio or goals"
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <Button
              disabled={saveProfile.isPending}
              onClick={() => saveProfile.mutate()}
              className="text-sm"
            >
              {saveProfile.isPending ? 'Saving…' : 'Join mentorship'}
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Active mentors</h3>
        {mentorsLoading ? (
          <p className="text-sm text-on-surface-variant">Loading mentors…</p>
        ) : mentors.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No mentors listed yet.</p>
        ) : (
          <ul className="space-y-2">
            {mentors.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
              >
                <p className="font-medium">
                  {m.user?.displayName || m.user?.username || m.userId?.slice(0, 8)}
                </p>
                {m.skills?.length ? (
                  <p className="text-xs text-on-surface-variant">{m.skills.join(', ')}</p>
                ) : null}
                <p className="mt-1 text-xs text-on-surface-variant">
                  {m.currentMentees ?? 0}/{m.maxMentees ?? '—'} mentees
                  {m.hasCapacity === false ? ' · full' : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Your matches</h3>
        {matchesLoading ? (
          <p className="text-sm text-on-surface-variant">Loading matches…</p>
        ) : asMentor.length === 0 && asMentee.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No matches yet.</p>
        ) : (
          <ul className="space-y-2">
            {[...asMentor, ...asMentee].map((match) => {
              const asMentorRow = asMentor.some((m) => m.id === match.id);
              return (
                <li
                  key={match.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
                >
                  <div>
                    <StatusPill tone="neutral" label={match.status} />
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {asMentorRow ? 'As mentor' : 'As mentee'}
                      {match.matchScore != null ? ` · score ${match.matchScore}` : ''}
                    </p>
                  </div>
                  {asMentorRow && match.status === 'pending' ? (
                    <div className="flex gap-2">
                      <Button
                        className="text-xs"
                        disabled={respond.isPending}
                        onClick={() => respond.mutate({ matchId: match.id, accept: true })}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        className="text-xs"
                        disabled={respond.isPending}
                        onClick={() => respond.mutate({ matchId: match.id, accept: false })}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
