'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  isVerified: boolean;
  followerCount: number;
  videoCount: number;
  createdAt: string;
}

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const { data } = await api.get(`/admin/users?${params}`);
      return data.data;
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch(`/admin/users/${id}`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search users…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 w-64"
          />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50">
            <tr>
              {['User', 'Email', 'Role', 'Followers', 'Videos', 'Joined', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.data?.map((user: User) => (
                  <tr key={user.id} className="hover:bg-gray-800/30 transition">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{user.displayName}</p>
                        <p className="text-gray-500 text-xs">@{user.username}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin' ? 'bg-red-500/10 text-red-400' :
                        user.role === 'creator' ? 'bg-indigo-500/10 text-indigo-400' :
                        'bg-gray-700 text-gray-300'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{user.followerCount}</td>
                    <td className="px-4 py-3 text-gray-400">{user.videoCount}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={(e) => updateRole.mutate({ id: user.id, role: e.target.value })}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                      >
                        <option value="user">user</option>
                        <option value="creator">creator</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {data?.meta && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-gray-800 text-sm text-gray-400">
            <span>
              Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} users
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40 hover:bg-gray-700 transition"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.meta.totalPages}
                className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40 hover:bg-gray-700 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
