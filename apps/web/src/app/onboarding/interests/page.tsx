'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const INTEREST_KEY = 'forge:interestCategoryIds';
const DONE_KEY = 'forge:interestsOnboardingDone';

type Category = { id: string; name: string; slug?: string };

/** Cold-start interest picker — stores real category UUIDs for recommendations. */
export default function InterestsOnboardingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['onboarding-categories'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Category[] }>('/categories');
      return data.data ?? [];
    },
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(INTEREST_KEY);
      if (raw) setSelected(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function finish() {
    setSaving(true);
    try {
      localStorage.setItem(INTEREST_KEY, JSON.stringify(selected));
      localStorage.setItem(DONE_KEY, 'true');
      if (isAuthenticated && selected.length) {
        await api.put('/users/me/interests', { categoryIds: selected });
      }
      router.push('/');
    } catch {
      router.push('/');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-12">
      <h1 className="font-display-forge text-3xl font-semibold text-on-surface">What are you into?</h1>
      <p className="mt-2 text-on-surface-variant">
        Pick a few interests so we can seed your For You feed. You can change this later.
      </p>
      {isLoading ? (
        <p className="mt-8 text-sm text-on-surface-variant" aria-busy="true">
          Loading categories…
        </p>
      ) : (
        <ul className="mt-8 flex flex-wrap gap-3">
          {categories.map((item) => {
            const on = selected.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(item.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    on ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'
                  }`}
                >
                  {item.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-10 flex gap-4">
        <button
          type="button"
          disabled={saving}
          onClick={() => void finish()}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
        <Link href="/" className="rounded-lg px-5 py-2.5 text-sm text-on-surface-variant hover:underline">
          Skip
        </Link>
      </div>
    </main>
  );
}
