'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Category } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  categories: Category[];
}

export function CategoryFilter({ categories }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get('category');

  const handleSelect = (slug: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set('category', slug);
    else params.delete('category');
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 mb-8 scrollbar-hide">
      <button
        onClick={() => handleSelect(null)}
        className={cn(
          'shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition',
          !activeCategory
            ? 'bg-forge-600 border-forge-600 text-white'
            : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white',
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => handleSelect(cat.slug)}
          className={cn(
            'shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition',
            activeCategory === cat.slug
              ? 'bg-forge-600 border-forge-600 text-white'
              : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white',
          )}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
