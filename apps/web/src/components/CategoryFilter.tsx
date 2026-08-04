'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Category } from '@/types';

interface Props {
  categories: Category[];
}

export function CategoryFilter({ categories }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get('category') || '';

  const setCategory = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set('category', slug);
    else params.delete('category');
    router.push(`/?${params.toString()}`);
  };

  return (
    <div
      className="mb-8 flex gap-3 overflow-x-auto pb-2 hide-scrollbar"
      role="tablist"
      aria-label="Categories"
    >
      <button
        type="button"
        role="tab"
        aria-selected={!active}
        onClick={() => setCategory('')}
        className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
          !active
            ? 'border-primary bg-primary/20 text-primary'
            : 'border-subtle bg-surface-container-low text-on-surface-variant hover:border-primary/50'
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          role="tab"
          aria-selected={active === cat.slug}
          onClick={() => setCategory(cat.slug)}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
            active === cat.slug
              ? 'border-primary bg-primary/20 text-primary'
              : 'border-subtle bg-surface-container-low text-on-surface-variant hover:border-primary/50'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
