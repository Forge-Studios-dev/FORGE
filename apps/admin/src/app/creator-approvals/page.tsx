'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminPagination } from '@/components/admin/AdminPagination';

interface PendingCreator {
  id: string;
  email: string;
  username: string;
  displayName: string;
  creatorRequestedAt: string | null;
  isVerified: boolean;
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
        meta: { total: number; page: number; totalPages: number };
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

  const creators = data?.data;

  return (
    <section>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Creator approvals" subtitle="Review pending creator requests" />
        <AdminSearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search applicants…"
        />
      </div>

      <AdminDataTable
        headers={['User', 'Email', 'Requested', 'Verified', 'Actions']}
        colCount={5}
        isLoading={isLoading}
        isEmpty={!isLoading && !creators?.length}
        emptyMessage="No pending creator requests."
        footer={
          data?.meta ? (
            <AdminPagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              total={data.meta.total}
              label="pending"
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          ) : undefined
        }
      >
        {creators?.map((user) => (
          <tr key={user.id} className="hover:bg-surface-container-high/30">
            <td className="px-4 py-3">
              <Link href={`/users/${user.id}`} className="group block">
                <p className="font-medium group-hover:text-primary">{user.displayName}</p>
                <p className="text-xs text-outline">@{user.username}</p>
              </Link>
            </td>
            <td className="px-4 py-3 text-on-surface-variant">{user.email}</td>
            <td className="px-4 py-3 text-on-surface-variant">
              {user.creatorRequestedAt ? new Date(user.creatorRequestedAt).toLocaleString() : '—'}
            </td>
            <td className="px-4 py-3">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  user.isVerified ? 'bg-secondary/10 text-secondary' : 'bg-surface-container-high text-outline'
                }`}
              >
                {user.isVerified ? 'verified' : 'unverified'}
              </span>
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => approve.mutate(user.id)}
                  disabled={approve.isPending || reject.isPending}
                  className="rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-xs text-secondary hover:bg-secondary/20 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const note = window.prompt('Reason for rejection (optional):') || undefined;
                    reject.mutate({ id: user.id, note });
                  }}
                  disabled={approve.isPending || reject.isPending}
                  className="rounded-full border border-error/40 px-3 py-1 text-xs text-error hover:bg-error/10 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </section>
  );
}
