'use client';

import { useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Category } from '@/types';

interface Props {
  categories: Category[];
}

export function CategoryFilter({ categories }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get('category') || '';
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const tabs = [
    { id: '', label: 'All' },
    ...categories.map((cat) => ({ id: cat.slug, label: cat.name })),
  ];

  const setCategory = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set('category', slug);
    else params.delete('category');
    router.push(`/?${params.toString()}`);
  };

  function focusTab(index: number) {
    const tab = tabs[(index + tabs.length) % tabs.length];
    refs.current[tab.id]?.focus();
    setCategory(tab.id);
  }

  return (
    <div
      className="mb-8 flex gap-3 overflow-x-auto pb-2 hide-scrollbar"
      role="tablist"
      aria-label="Categories"
      aria-orientation="horizontal"
    >
      {tabs.map((tab, i) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id || 'all'}
            ref={(el) => {
              refs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => setCategory(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                focusTab(i + 1);
              }
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                focusTab(i - 1);
              }
              if (e.key === 'Home') {
                e.preventDefault();
                focusTab(0);
              }
              if (e.key === 'End') {
                e.preventDefault();
                focusTab(tabs.length - 1);
              }
            }}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
              selected
                ? 'border-primary bg-primary/20 text-primary'
                : 'border-subtle bg-surface-container-low text-on-surface-variant hover:border-primary/50'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
