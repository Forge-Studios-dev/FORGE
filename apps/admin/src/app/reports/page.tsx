'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader, StatusPill, type StatusTone } from '@forge/design-system';
import { DataTable, useToast } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { AdminPagination } from '@/components/admin/AdminPagination';
import type { AdminReport } from '@/lib/admin-user-types';

const STATUS_TONE: Record<string, StatusTone> = {
  pending: 'warning',
  reviewed: 'success',
  dismissed: 'neutral',
};

export default function ReportsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<AdminReport[]>([]);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-reports', page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/admin/reports?${params}`);
      return data.data as { data: AdminReport[]; meta: { total: number; page: number; totalPages: number } };
    },
  });

  const bulkUpdate = useMutation({
    mutationFn: (payload: { ids: string[]; status: string }) => api.patch('/admin/reports/bulk', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports'] }),
  });

  function runBulk(status: 'reviewed' | 'dismissed', label: string) {
    const ids = selected.map((r) => r.id);
    const prevStatuses = selected.map((r) => ({ id: r.id, status: r.status }));
    bulkUpdate.mutate(
      { ids, status },
      {
        onSuccess: () => {
          toast({
            title: `${label} — ${ids.length} report${ids.length === 1 ? '' : 's'}`,
            variant: 'success',
            action: {
              label: 'Undo',
              onClick: async () => {
                await Promise.all(prevStatuses.map((r) => api.patch(`/admin/reports/${r.id}`, { status: r.status })));
                qc.invalidateQueries({ queryKey: ['admin-reports'] });
              },
            },
          });
          setSelected([]);
        },
        onError: () => toast({ title: 'Bulk update failed', variant: 'critical' }),
      },
    );
  }

  const reports = data?.data;

  const columns = useMemo<ColumnDef<AdminReport, unknown>[]>(
    () => [
      {
        id: 'report',
        header: 'Report',
        cell: ({ row }) => (
          <Link href={`/reports/${row.original.id}`} className="group block max-w-md">
            <p className="font-medium text-on-surface group-hover:text-primary">{row.original.targetType}</p>
            <p className="line-clamp-1 text-xs text-on-surface-variant">{row.original.reason}</p>
          </Link>
        ),
      },
      {
        id: 'reporter',
        header: 'Reporter',
        cell: ({ row }) => (
          <span className="text-on-surface-variant">
            {row.original.reporter ? `@${row.original.reporter.username}` : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue<string>();
          return <StatusPill tone={STATUS_TONE[status] ?? STATUS_TONE.pending} label={status} />;
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ getValue }) => (
          <span className="text-on-surface-variant">{new Date(getValue<string>()).toLocaleString()}</span>
        ),
      },
    ],
    [],
  );

  if (isError) {
    return (
      <section>
        <PageHeader title="Reports" subtitle="User and content reports from the platform" />
        <p className="text-error">Failed to load reports.</p>
        <button type="button" onClick={() => refetch()} className="mt-4 text-sm text-primary hover:underline">
          Retry
        </button>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-8 flex flex-col gap-4">
        <PageHeader title="Reports" subtitle="User and content reports from the platform" />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="w-fit rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={reports ?? []}
        getRowId={(r) => r.id}
        loading={isLoading}
        selectable
        onSelectionChange={setSelected}
        emptyState={{ title: 'Inbox clear', description: 'No reports match this filter.' }}
        bulkActions={() => (
          <>
            <button
              type="button"
              onClick={() => runBulk('reviewed', 'Marked reviewed')}
              className="rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold hover:border-success hover:text-success"
            >
              Mark reviewed
            </button>
            <button
              type="button"
              onClick={() => runBulk('dismissed', 'Dismissed')}
              className="rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold hover:border-critical hover:text-critical"
            >
              Dismiss
            </button>
          </>
        )}
      />
      {data?.meta ? (
        <AdminPagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          label="reports"
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      ) : null}
    </section>
  );
}
