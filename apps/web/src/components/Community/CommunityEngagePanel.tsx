'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type WikiPage = { id: string; title: string; body: string; slug: string };
type Challenge = { id: string; title: string; description?: string | null };
type SurveyQuestion = { question: string; type?: string; options?: string[] };
type Survey = { id: string; title: string; questions: SurveyQuestion[] };
type Room = { id: string; name: string; roomType: string; description?: string | null; settings?: { requiredTierId?: string } };

const LIVEKIT_ENABLED = !!process.env.NEXT_PUBLIC_LIVEKIT_URL;

interface Props {
  communityId: string;
}

export function CommunityEngagePanel({ communityId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expandedWiki, setExpandedWiki] = useState<string | null>(null);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, unknown[]>>({});

  const { data: wikiPages } = useQuery({
    queryKey: ['community-wiki', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: WikiPage[] }>(`/communities/${communityId}/wiki`);
      return data.data ?? [];
    },
  });

  const { data: challenges } = useQuery({
    queryKey: ['community-challenges', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Challenge[] }>(
        `/communities/${communityId}/challenges`,
      );
      return data.data ?? [];
    },
  });

  const { data: surveys } = useQuery({
    queryKey: ['community-surveys', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Survey[] }>(`/communities/${communityId}/surveys`);
      return data.data ?? [];
    },
  });

  const { data: rooms } = useQuery({
    queryKey: ['community-rooms', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Room[] }>(`/communities/${communityId}/rooms`);
      return data.data ?? [];
    },
  });

  const voiceRooms = (rooms ?? []).filter((r) => r.roomType !== 'text');
  const textRooms = (rooms ?? []).filter((r) => r.roomType === 'text');

  const joinMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      await api.post(`/communities/${communityId}/challenges/${challengeId}/join`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['community-challenges', communityId] });
    },
  });

  const progressMutation = useMutation({
    mutationFn: async ({ challengeId, progressPercent }: { challengeId: string; progressPercent: number }) => {
      await api.patch(`/communities/${communityId}/challenges/${challengeId}/progress`, {
        progressPercent,
      });
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ surveyId, answers }: { surveyId: string; answers: unknown[] }) => {
      await api.post(`/communities/${communityId}/surveys/${surveyId}/respond`, { answers });
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['community-surveys', communityId] });
      setSurveyAnswers((prev) => {
        const next = { ...prev };
        delete next[vars.surveyId];
        return next;
      });
    },
  });

  const hasContent =
    (wikiPages ?? []).length > 0 ||
    (challenges ?? []).length > 0 ||
    (surveys ?? []).length > 0 ||
    voiceRooms.length > 0 ||
    textRooms.length > 0;

  if (!hasContent) {
    return (
      <p className="text-sm text-on-surface-variant">
        No wiki pages, challenges, surveys, or voice rooms yet — check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {textRooms.length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-label-caps text-xs text-outline">Text rooms</h3>
          <ul className="space-y-2">
            {textRooms.map((room) => (
              <li
                key={room.id}
                className="rounded-xl border border-outline-variant/30 px-4 py-3"
              >
                <p className="font-medium text-sm">{room.name}</p>
                {room.description ? (
                  <p className="mt-1 text-xs text-on-surface-variant">{room.description}</p>
                ) : null}
                {user ? (
                  <Link
                    href={`/community/${communityId}/text/${room.id}`}
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    Open chat →
                  </Link>
                ) : (
                  <p className="mt-2 text-xs text-on-surface-variant">Sign in to chat.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {voiceRooms.length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-label-caps text-xs text-outline">Voice & stage rooms</h3>
          <ul className="space-y-2">
            {voiceRooms.map((room) => (
              <li
                key={room.id}
                className="rounded-xl border border-outline-variant/30 px-4 py-3"
              >
                <p className="font-medium text-sm">{room.name}</p>
                <p className="text-xs text-outline">
                  {room.roomType}
                  {room.settings?.requiredTierId ? ' · VIP' : ''}
                </p>
                {user && LIVEKIT_ENABLED ? (
                  <Link
                    href={`/community/${communityId}/voice/${room.id}`}
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    Join room →
                  </Link>
                ) : (
                  <p className="mt-2 text-xs text-on-surface-variant">
                    {LIVEKIT_ENABLED ? 'Sign in to join.' : 'Voice rooms require LiveKit.'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {(wikiPages ?? []).length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-label-caps text-xs text-outline">Knowledge base</h3>
          <ul className="space-y-2">
            {(wikiPages ?? []).map((page) => (
              <li key={page.id} className="rounded-xl border border-outline-variant/30">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
                  onClick={() =>
                    setExpandedWiki(expandedWiki === page.id ? null : page.id)
                  }
                >
                  {page.title}
                  <span className="text-outline">{expandedWiki === page.id ? '−' : '+'}</span>
                </button>
                {expandedWiki === page.id ? (
                  <div className="border-t border-outline-variant/30 px-4 py-3 text-sm whitespace-pre-wrap text-on-surface-variant">
                    {page.body || 'No content yet.'}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(challenges ?? []).length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-label-caps text-xs text-outline">Challenges</h3>
          <ul className="space-y-2">
            {(challenges ?? []).map((ch) => (
              <li
                key={ch.id}
                className="rounded-xl border border-outline-variant/30 px-4 py-3"
              >
                <p className="font-medium text-sm">{ch.title}</p>
                {ch.description ? (
                  <p className="mt-1 text-xs text-on-surface-variant">{ch.description}</p>
                ) : null}
                {user ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="text-xs"
                      disabled={joinMutation.isPending}
                      onClick={() => joinMutation.mutate(ch.id)}
                    >
                      Join challenge
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-xs"
                      disabled={progressMutation.isPending}
                      onClick={() => progressMutation.mutate({ challengeId: ch.id, progressPercent: 50 })}
                    >
                      Mark 50%
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-xs"
                      disabled={progressMutation.isPending}
                      onClick={() => progressMutation.mutate({ challengeId: ch.id, progressPercent: 100 })}
                    >
                      Complete
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-on-surface-variant">Sign in to join.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(surveys ?? []).length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-label-caps text-xs text-outline">Surveys</h3>
          {(surveys ?? []).map((survey) => (
            <div
              key={survey.id}
              className="space-y-3 rounded-xl border border-outline-variant/30 p-4"
            >
              <p className="font-medium text-sm">{survey.title}</p>
              {(survey.questions ?? []).map((q, qi) => (
                <div key={qi} className="space-y-1">
                  <p className="text-xs font-medium">{q.question}</p>
                  {q.options && q.options.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className="rounded-full border border-outline-variant/40 px-3 py-1 text-xs hover:bg-surface-container-high"
                          onClick={() => {
                            const answers = [...(surveyAnswers[survey.id] ?? [])];
                            answers[qi] = opt;
                            setSurveyAnswers((prev) => ({ ...prev, [survey.id]: answers }));
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Input
                      placeholder="Your answer"
                      onChange={(e) => {
                        const answers = [...(surveyAnswers[survey.id] ?? [])];
                        answers[qi] = e.target.value;
                        setSurveyAnswers((prev) => ({ ...prev, [survey.id]: answers }));
                      }}
                    />
                  )}
                </div>
              ))}
              {user ? (
                <Button
                  variant="secondary"
                  className="text-xs"
                  disabled={respondMutation.isPending}
                  onClick={() =>
                    respondMutation.mutate({
                      surveyId: survey.id,
                      answers: surveyAnswers[survey.id] ?? [],
                    })
                  }
                >
                  Submit survey
                </Button>
              ) : (
                <p className="text-xs text-on-surface-variant">Sign in to respond.</p>
              )}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
