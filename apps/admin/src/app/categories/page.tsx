'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  createdAt: string;
}

export default function CategoriesPage() {
  const { data, isLoading } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.data;
    },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Categories</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse h-28" />
            ))
          : data?.map((cat) => (
              <div key={cat.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{cat.name}</h3>
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">
                    #{cat.sortOrder}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{cat.slug}</p>
              </div>
            ))}
      </div>
    </div>
  );
}
