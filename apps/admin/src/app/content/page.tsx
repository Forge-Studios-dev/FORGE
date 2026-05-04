'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Video {
  id: string;
  title: string;
  status: string;
  visibility: string;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  user: { displayName: string; username: string };
}

const STATUS_BADGE: Record<string, string> = {
  ready: 'bg-green-500/10 text-green-400',
  processing: 'bg-yellow-500/10 text-yellow-400',
  pending: 'bg-gray-500/10 text-gray-400',
  failed: 'bg-red-500/10 text-red-400',
};

export default function ContentPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-videos', page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/admin/videos?${params}`);
      return data.data;
    },
  });

  const updateVideo = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/videos/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-videos'] }),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Content</h1>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">All statuses</option>
          <option value="ready">Ready</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50">
            <tr>
              {['Title', 'Creator', 'Status', 'Views', 'Likes', 'Date', 'Actions'].map((h) => (
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
              : data?.data?.map((video: Video) => (
                  <tr key={video.id} className="hover:bg-gray-800/30 transition">
                    <td className="px-4 py-3 max-w-xs truncate font-medium">{video.title}</td>
                    <td className="px-4 py-3 text-gray-400">
                      <div>
                        <p>{video.user?.displayName}</p>
                        <p className="text-xs text-gray-500">@{video.user?.username}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[video.status] || 'bg-gray-700 text-gray-300'}`}>
                        {video.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{video.viewCount}</td>
                    <td className="px-4 py-3 text-gray-400">{video.likeCount}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(video.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => updateVideo.mutate({ id: video.id, status: 'failed' })}
                        className="text-xs text-red-400 hover:text-red-300 transition"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {data?.meta && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-gray-800 text-sm text-gray-400">
            <span>Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} videos</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Prev</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.meta.totalPages} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
