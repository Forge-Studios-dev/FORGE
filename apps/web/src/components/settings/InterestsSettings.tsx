'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@forge/design-system';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-message';

const MAX_INTERESTS = 5;

type Category = { id: string; name: string };

/** Edit cold-start interest categories (onboarding parity). */
export function InterestsSettings() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  const categoriesQuery = useQuery({
    queryKey: ['settings-categories'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Category[] }>('/categories');
      return data.data ?? [];
    },
  });

  const interestsQuery = useQuery({
    queryKey: ['my-interests'],
    queryFn: async () => {
      const { data } = await api.get<{ data: { categoryIds: string[] } }>('/users/me/interests');
      return data.data?.categoryIds ?? [];
    },
  });

  useEffect(() => {
    if (interestsQuery.data) setSelected(interestsQuery.data);
  }, [interestsQuery.data]);

  const save = useMutation({
    mutationFn: async (categoryIds: string[]) => {
      await api.put('/users/me/interests', { categoryIds });
    },
    onSuccess: () => {
      setMessage('Interests saved.');
      void qc.invalidateQueries({ queryKey: ['my-interests'] });
    },
    onError: (e) => {
      setMessage(getApiErrorMessage(e, 'Could not save interests.'));
    },
  });

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_INTERESTS) return prev;
      return [...prev, id];
    });
    setMessage('');
  }

  const categories = categoriesQuery.data ?? [];
  const dirty =
    selected.length !== (interestsQuery.data?.length ?? 0) ||
    selected.some((id) => !(interestsQuery.data ?? []).includes(id));

  return (
    <section id="interests" className="glass-panel mt-8 rounded-2xl p-6">
      <h2 className="font-display-forge text-lg font-semibold">Interests</h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        Pick up to {MAX_INTERESTS} topics to personalize your For You feed. You can change these
        anytime.
      </p>

      {categoriesQuery.isLoading || interestsQuery.isLoading ? (
        <p className="mt-4 text-sm text-on-surface-variant">Loading…</p>
      ) : null}
      {categoriesQuery.isError || interestsQuery.isError ? (
        <p className="mt-4 text-sm text-error" role="alert">
          Could not load interests.
        </p>
      ) : null}

      {categories.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {categories.map((item) => {
            const on = selected.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={save.isPending}
                  onClick={() => toggle(item.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    on
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface hover:opacity-90'
                  }`}
                >
                  {item.name}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="primary"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate(selected)}
          className="px-5 py-2"
        >
          {save.isPending ? 'Saving…' : 'Save interests'}
        </Button>
        <span className="text-xs text-on-surface-variant">
          {selected.length}/{MAX_INTERESTS} selected
        </span>
      </div>
      {message ? (
        <p className="mt-2 text-sm text-on-surface-variant" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
