'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@forge/design-system';
import { api } from '@/lib/api';

interface Props {
  communityId: string;
  onCreated?: () => void;
}

type WikiPage = { id: string; title: string; body?: string | null };
type Challenge = { id: string; title: string; description?: string | null; isActive?: boolean };
type Survey = { id: string; title: string; isActive?: boolean };

export function StudioEngagementExtrasPanel({ communityId, onCreated }: Props) {
  const qc = useQueryClient();
  const [wikiTitle, setWikiTitle] = useState('');
  const [wikiBody, setWikiBody] = useState('');
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeDesc, setChallengeDesc] = useState('');
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyQuestions, setSurveyQuestions] = useState('What do you want to learn?\nHow often do you practice?');
  const [editingWikiId, setEditingWikiId] = useState<string | null>(null);
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
  const [analyticsSurveyId, setAnalyticsSurveyId] = useState<string | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['community-wiki', communityId] });
    void qc.invalidateQueries({ queryKey: ['community-challenges', communityId] });
    void qc.invalidateQueries({ queryKey: ['community-surveys', communityId] });
    onCreated?.();
  };

  const { data: wikiPages } = useQuery({
    queryKey: ['studio-wiki', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: WikiPage[] } }>(
        `/communities/${communityId}/wiki`,
      );
      return data.data?.data ?? [];
    },
  });

  const { data: challenges } = useQuery({
    queryKey: ['studio-challenges', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: Challenge[] } }>(
        `/communities/${communityId}/challenges`,
      );
      return data.data?.data ?? [];
    },
  });

  const { data: surveys } = useQuery({
    queryKey: ['studio-surveys', communityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: Survey[] } }>(
        `/communities/${communityId}/surveys`,
      );
      return data.data?.data ?? [];
    },
  });

  const { data: surveyAnalytics } = useQuery({
    queryKey: ['studio-survey-analytics', communityId, analyticsSurveyId],
    enabled: !!analyticsSurveyId,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { responseCount: number; title: string; isActive?: boolean; closesAt?: string | null };
      }>(`/creators/me/communities/${communityId}/surveys/${analyticsSurveyId}/analytics`);
      return data.data;
    },
  });

  const wikiMutation = useMutation({
    mutationFn: async () => {
      if (editingWikiId) {
        await api.patch(`/creators/me/communities/${communityId}/wiki/${editingWikiId}`, {
          title: wikiTitle.trim(),
          body: wikiBody.trim(),
        });
      } else {
        await api.post(`/creators/me/communities/${communityId}/wiki`, {
          title: wikiTitle.trim(),
          body: wikiBody.trim(),
        });
      }
    },
    onSuccess: () => {
      setWikiTitle('');
      setWikiBody('');
      setEditingWikiId(null);
      invalidate();
    },
  });

  const challengeMutation = useMutation({
    mutationFn: async () => {
      if (editingChallengeId) {
        await api.patch(`/creators/me/communities/${communityId}/challenges/${editingChallengeId}`, {
          title: challengeTitle.trim(),
          description: challengeDesc.trim() || undefined,
        });
      } else {
        await api.post(`/creators/me/communities/${communityId}/challenges`, {
          title: challengeTitle.trim(),
          description: challengeDesc.trim() || undefined,
        });
      }
    },
    onSuccess: () => {
      setChallengeTitle('');
      setChallengeDesc('');
      setEditingChallengeId(null);
      invalidate();
    },
  });

  const surveyMutation = useMutation({
    mutationFn: async () => {
      const lines = surveyQuestions
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const payload = {
        title: surveyTitle.trim(),
        questions: lines.map((question) => ({ question, type: 'text' })),
      };
      if (editingSurveyId) {
        await api.patch(`/creators/me/communities/${communityId}/surveys/${editingSurveyId}`, payload);
      } else {
        await api.post(`/creators/me/communities/${communityId}/surveys`, payload);
      }
    },
    onSuccess: () => {
      setSurveyTitle('');
      setEditingSurveyId(null);
      invalidate();
    },
  });

  const deleteWikiMutation = useMutation({
    mutationFn: async (wikiId: string) => {
      await api.delete(`/creators/me/communities/${communityId}/wiki/${wikiId}`);
    },
    onSuccess: invalidate,
  });

  const deleteChallengeMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      await api.delete(`/creators/me/communities/${communityId}/challenges/${challengeId}`);
    },
    onSuccess: invalidate,
  });

  const deleteSurveyMutation = useMutation({
    mutationFn: async (surveyId: string) => {
      await api.delete(`/creators/me/communities/${communityId}/surveys/${surveyId}`);
    },
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-6">
      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">Wiki page</h2>
        <Input value={wikiTitle} onChange={(e) => setWikiTitle(e.target.value)} placeholder="Page title" />
        <textarea
          value={wikiBody}
          onChange={(e) => setWikiBody(e.target.value)}
          placeholder="Page content"
          rows={4}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
        />
        <Button
          disabled={!wikiTitle.trim() || wikiMutation.isPending}
          onClick={() => wikiMutation.mutate()}
        >
          {editingWikiId ? 'Save wiki page' : 'Add wiki page'}
        </Button>
        {(wikiPages ?? []).length > 0 ? (
          <ul className="space-y-2 border-t border-outline-variant/30 pt-3">
            {(wikiPages ?? []).map((page) => (
              <li
                key={page.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{page.title}</p>
                  {page.body ? <p className="text-xs text-on-surface-variant">{page.body}</p> : null}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    className="text-xs"
                    onClick={() => {
                      setEditingWikiId(page.id);
                      setWikiTitle(page.title);
                      setWikiBody(page.body ?? '');
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-xs text-error"
                    disabled={deleteWikiMutation.isPending}
                    onClick={() => deleteWikiMutation.mutate(page.id)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">Challenge</h2>
        <Input
          value={challengeTitle}
          onChange={(e) => setChallengeTitle(e.target.value)}
          placeholder="Challenge title"
        />
        <textarea
          value={challengeDesc}
          onChange={(e) => setChallengeDesc(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
        />
        <Button
          disabled={!challengeTitle.trim() || challengeMutation.isPending}
          onClick={() => challengeMutation.mutate()}
        >
          {editingChallengeId ? 'Save challenge' : 'Launch challenge'}
        </Button>
        {(challenges ?? []).length > 0 ? (
          <ul className="space-y-2 border-t border-outline-variant/30 pt-3">
            {(challenges ?? []).map((ch) => (
              <li
                key={ch.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{ch.title}</p>
                  {ch.description ? (
                    <p className="text-xs text-on-surface-variant">{ch.description}</p>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    className="text-xs"
                    onClick={() => {
                      setEditingChallengeId(ch.id);
                      setChallengeTitle(ch.title);
                      setChallengeDesc(ch.description ?? '');
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-xs text-error"
                    disabled={deleteChallengeMutation.isPending}
                    onClick={() => deleteChallengeMutation.mutate(ch.id)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="glass-panel space-y-3 rounded-xl p-6">
        <h2 className="font-label-caps text-outline">Survey</h2>
        <Input
          value={surveyTitle}
          onChange={(e) => setSurveyTitle(e.target.value)}
          placeholder="Survey title"
        />
        <textarea
          value={surveyQuestions}
          onChange={(e) => setSurveyQuestions(e.target.value)}
          placeholder="One question per line"
          rows={4}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
        />
        <Button
          disabled={!surveyTitle.trim() || surveyMutation.isPending}
          onClick={() => surveyMutation.mutate()}
        >
          {editingSurveyId ? 'Save survey' : 'Publish survey'}
        </Button>
        {(surveys ?? []).length > 0 ? (
          <ul className="space-y-2 border-t border-outline-variant/30 pt-3">
            {(surveys ?? []).map((survey) => (
              <li
                key={survey.id}
                className="rounded-lg border border-outline-variant/30 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{survey.title}</p>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      className="text-xs"
                      onClick={() => {
                        setAnalyticsSurveyId(analyticsSurveyId === survey.id ? null : survey.id);
                      }}
                    >
                      Analytics
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-xs"
                      onClick={() => {
                        setEditingSurveyId(survey.id);
                        setSurveyTitle(survey.title);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-xs text-error"
                      disabled={deleteSurveyMutation.isPending}
                      onClick={() => deleteSurveyMutation.mutate(survey.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                {analyticsSurveyId === survey.id && surveyAnalytics ? (
                  <p className="mt-2 text-xs text-on-surface-variant">
                    {surveyAnalytics.responseCount} responses
                    {surveyAnalytics.isActive === false ? ' · inactive' : ''}
                    {surveyAnalytics.closesAt
                      ? ` · closes ${new Date(surveyAnalytics.closesAt).toLocaleDateString()}`
                      : ''}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
