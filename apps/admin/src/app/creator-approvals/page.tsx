'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Button, PageHeader, StatusPill } from '@forge/design-system';
import { DataTable, useToast } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
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
  const [selected, setSelected] = useState<PendingCreator[]>([]);
  const [rejectNote, setRejectNote] = useState('');
  const qc = useQueryClient();
  const { toast } = useToast();

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-creators-pending'] });
      toast({ title: 'Creator approved', variant: 'success' });
    },
    onError: () => toast({ title: 'Could not approve creator', variant: 'critical' }),
  });

  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => api.post(`/admin/creators/${id}/reject`, { note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-creators-pending'] });
      toast({ title: 'Creator rejected', variant: 'success' });
    },
    onError: () => toast({ title: 'Could not reject creator', variant: 'critical' }),
  });

  const bulkApprove = useMutation({
    mutationFn: (ids: string[]) => api.post('/admin/creators/bulk-approve', { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-creators-pending'] }),
    onError: () => toast({ title: 'Bulk approve failed', variant: 'critical' }),
  });

  const bulkReject = useMutation({
    mutationFn: ({ ids, note }: { ids: string[]; note?: string }) =>
      api.post('/admin/creators/bulk-reject', { ids, note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-creators-pending'] }),
    onError: () => toast({ title: 'Bulk reject failed', variant: 'critical' }),
  });

  function runBulkApprove() {
    const ids = selected.map((c) => c.id);
    bulkApprove.mutate(ids, {
      onSuccess: () => {
        toast({ title: `Approved ${ids.length} creator${ids.length === 1 ? '' : 's'}`, variant: 'success' });
        setSelected([]);
      },
      onError: () => toast({ title: 'Bulk approve failed', variant: 'critical' }),
    });
  }

  function runBulkReject() {
    const ids = selected.map((c) => c.id);
    bulkReject.mutate(
      { ids, note: rejectNote || undefined },
      {
        onSuccess: () => {
          toast({ title: `Rejected ${ids.length} creator${ids.length === 1 ? '' : 's'}`, variant: 'success' });
          setSelected([]);
          setRejectNote('');
        },
        onError: () => toast({ title: 'Bulk reject failed', variant: 'critical' }),
      },
    );
  }

  const creators = data?.data;

  const columns = useMemo<ColumnDef<PendingCreator, unknown>[]>(
    () => [
      {
        id: 'user',
        header: 'User',
        cell: ({ row }) => (
          <Link href={`/users/${row.original.id}`} className="group block">
            <p className="font-medium group-hover:text-primary">{row.original.displayName}</p>
            <p className="text-xs text-outline">@{row.original.username}</p>
          </Link>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => <span className="text-on-surface-variant">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'creatorRequestedAt',
        header: 'Requested',
        cell: ({ getValue }) => {
          const v = getValue<string | null>();
          return <span className="text-on-surface-variant">{v ? new Date(v).toLocaleString() : '—'}</span>;
        },
      },
      {
        accessorKey: 'isVerified',
        header: 'Verified',
        cell: ({ getValue }) => (
          <StatusPill tone={getValue<boolean>() ? 'success' : 'neutral'} label={getValue<boolean>() ? 'verified' : 'unverified'} />
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const user = row.original;
          return (
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
                onClick={() => reject.mutate({ id: user.id, note: rejectNote || undefined })}
                disabled={approve.isPending || reject.isPending}
                className="rounded-full border border-error/40 px-3 py-1 text-xs text-error hover:bg-error/10 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          );
        },
      },
    ],
    [approve, reject, rejectNote],
  );

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

      <DataTable
        columns={columns}
        data={creators ?? []}
        getRowId={(c) => c.id}
        loading={isLoading}
        selectable
        onSelectionChange={setSelected}
        emptyState={{ title: 'No pending creator requests', description: 'New applications will show up here.' }}
        bulkActions={() => (
          <>
            <input
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Rejection note (optional, applies to reject actions)"
              className="w-64 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 text-xs"
            />
            <Button variant="secondary" onClick={runBulkApprove} className="!px-3 !py-1 text-xs">
              Approve
            </Button>
            <button
              type="button"
              onClick={runBulkReject}
              className="rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold hover:border-critical hover:text-critical"
            >
              Reject
            </button>
          </>
        )}
      />
      {data?.meta ? (
        <AdminPagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          label="pending"
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      ) : null}
    </section>
  );
}
