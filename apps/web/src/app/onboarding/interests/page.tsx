'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const INTEREST_KEY = 'forge:interestCategoryIds';
const DONE_KEY = 'forge:interestsOnboardingDone';

/** Lightweight cold-start interest picker (M-Q2). Persists category IDs in localStorage for feed personalization clients. */
const SUGGESTED = [
  { id: 'music', label: 'Music' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'cooking', label: 'Cooking' },
  { id: 'tech', label: 'Tech' },
  { id: 'art', label: 'Art' },
  { id: 'business', label: 'Business' },
];

export default function InterestsOnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

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

  function finish() {
    localStorage.setItem(INTEREST_KEY, JSON.stringify(selected));
    localStorage.setItem(DONE_KEY, 'true');
    router.push('/');
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-12">
      <h1 className="font-display-forge text-3xl font-semibold text-on-surface">What are you into?</h1>
      <p className="mt-2 text-on-surface-variant">
        Pick a few interests so we can seed your For You feed. You can change this later.
      </p>
      <ul className="mt-8 flex flex-wrap gap-3">
        {SUGGESTED.map((item) => {
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
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-10 flex gap-4">
        <button
          type="button"
          onClick={finish}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary"
        >
          Continue
        </button>
        <Link href="/" className="rounded-lg px-5 py-2.5 text-sm text-on-surface-variant hover:underline">
          Skip
        </Link>
      </div>
    </main>
  );
}
