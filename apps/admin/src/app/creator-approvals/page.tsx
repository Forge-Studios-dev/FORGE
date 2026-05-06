'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';

interface PendingCreator {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  creatorStatus: string | null;
  creatorRequestedAt: string | null;
  isVerified: boolean;
  createdAt: string;
}

export default function CreatorApprovalsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-creators-pending', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const { data } = await api.get(`/admin/creators/pending?${params}`);
      return data.data as {
        data: PendingCreator[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      };
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/admin/creators/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-creators-pending'] }),
  });

  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.post(`/admin/creators/${id}/reject`, { note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-creators-pending'] }),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Creator approvals</h1>
          <p className="text-sm text-gray-500 mt-1">Review pending creator requests.</p>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search users…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 w-64"
          />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50">
            <tr>
              {['User', 'Email', 'Requested', 'Verified', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.data?.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-800/30 transition">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{user.displayName}</p>
                        <p className="text-gray-500 text-xs">@{user.username}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{user.email}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {user.creatorRequestedAt ? new Date(user.creatorRequestedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.isVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {user.isVerified ? 'verified' : 'unverified'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => approve.mutate(user.id)}
                          disabled={approve.isPending || reject.isPending}
                          className="px-3 py-1 bg-emerald-600/20 text-emerald-300 border border-emerald-600/20 rounded hover:bg-emerald-600/30 disabled:opacity-50 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            const note = window.prompt('Reason for rejection (optional):') || undefined;
                            reject.mutate({ id: user.id, note });
                          }}
                          disabled={approve.isPending || reject.isPending}
                          className="px-3 py-1 bg-red-600/20 text-red-300 border border-red-600/20 rounded hover:bg-red-600/30 disabled:opacity-50 transition"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {data?.meta && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-gray-800 text-sm text-gray-400">
            <span>
              Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} pending
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

