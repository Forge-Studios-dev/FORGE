'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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

const SEVERITY_TONE: Record<string, StatusTone> = {
  p0: 'critical',
  p1: 'warning',
  p2: 'primary',
  p3: 'neutral',
};

const SEVERITY_OPTIONS = [
  { id: '', label: 'All severity' },
  { id: 'p0', label: 'P0' },
  { id: 'p1', label: 'P1' },
  { id: 'p2', label: 'P2' },
  { id: 'p3', label: 'P3' },
] as const;

const TARGET_OPTIONS = [
  { id: '', label: 'All targets' },
  { id: 'video', label: 'Video' },
  { id: 'comment', label: 'Comment' },
  { id: 'user', label: 'User' },
] as const;

function parseStatus(raw: string | null): string {
  if (raw === 'pending' || raw === 'reviewed' || raw === 'dismissed') return raw;
  return '';
}

function parseSeverity(raw: string | null): string {
  if (raw === 'p0' || raw === 'p1' || raw === 'p2' || raw === 'p3') return raw;
  return '';
}

function parseTargetType(raw: string | null): string {
  if (raw === 'video' || raw === 'comment' || raw === 'user') return raw;
  return '';
}

function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<p className="text-on-surface-variant">Loading reports…</p>}>
      <ReportsPageInner />
    </Suspense>
  );
}

function ReportsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get('status');
  const severityParam = searchParams.get('severity');
  const targetTypeParam = searchParams.get('targetType');
  const pageParam = searchParams.get('page');

  const [page, setPage] = useState(() => parsePage(pageParam));
  const [statusFilter, setStatusFilter] = useState(() => parseStatus(statusParam));
  const [severityFilter, setSeverityFilter] = useState(() => parseSeverity(severityParam));
  const [targetTypeFilter, setTargetTypeFilter] = useState(() => parseTargetType(targetTypeParam));
  const [selected, setSelected] = useState<AdminReport[]>([]);
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    setStatusFilter(parseStatus(statusParam));
    setSeverityFilter(parseSeverity(severityParam));
    setTargetTypeFilter(parseTargetType(targetTypeParam));
    setPage(parsePage(pageParam));
  }, [statusParam, severityParam, targetTypeParam, pageParam]);

  function syncUrl(next: {
    status?: string;
    severity?: string;
    targetType?: string;
    page?: number;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const status = next.status ?? statusFilter;
    const severity = next.severity ?? severityFilter;
    const targetType = next.targetType ?? targetTypeFilter;
    const nextPage = next.page ?? page;

    if (status) params.set('status', status);
    else params.delete('status');
    if (severity) params.set('severity', severity);
    else params.delete('severity');
    if (targetType) params.set('targetType', targetType);
    else params.delete('targetType');
    if (nextPage > 1) params.set('page', String(nextPage));
    else params.delete('page');

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-reports', page, statusFilter, severityFilter, targetTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (severityFilter) params.set('severity', severityFilter);
      if (targetTypeFilter) params.set('targetType', targetTypeFilter);
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
        id: 'severity',
        header: 'Severity',
        cell: ({ row }) => {
          const severity = (row.original.severity ?? 'p3').toLowerCase();
          return (
            <StatusPill
              tone={SEVERITY_TONE[severity] ?? SEVERITY_TONE.p3}
              label={severity.toUpperCase()}
            />
          );
        },
      },
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
        <PageHeader
          title="Reports"
          subtitle="Severity-first triage (P0 before P3). User and content reports from the platform."
        />
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              const next = e.target.value;
              setStatusFilter(next);
              setPage(1);
              syncUrl({ status: next, page: 1 });
            }}
            className="w-fit rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <div role="tablist" aria-label="Target type filter" className="flex flex-wrap gap-2">
            {TARGET_OPTIONS.map((opt) => (
              <button
                key={opt.id || 'all-targets'}
                type="button"
                role="tab"
                aria-selected={targetTypeFilter === opt.id}
                onClick={() => {
                  setTargetTypeFilter(opt.id);
                  setPage(1);
                  syncUrl({ targetType: opt.id, page: 1 });
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  targetTypeFilter === opt.id
                    ? 'bg-on-surface text-surface'
                    : 'border border-outline-variant/40 text-on-surface-variant hover:border-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div role="tablist" aria-label="Severity filter" className="flex flex-wrap gap-2">
            {SEVERITY_OPTIONS.map((opt) => (
              <button
                key={opt.id || 'all'}
                type="button"
                role="tab"
                aria-selected={severityFilter === opt.id}
                onClick={() => {
                  setSeverityFilter(opt.id);
                  setPage(1);
                  syncUrl({ severity: opt.id, page: 1 });
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  severityFilter === opt.id
                    ? 'bg-on-surface text-surface'
                    : 'border border-outline-variant/40 text-on-surface-variant hover:border-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
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
          onPrev={() => {
            const next = Math.max(1, page - 1);
            setPage(next);
            syncUrl({ page: next });
          }}
          onNext={() => {
            const next = page + 1;
            setPage(next);
            syncUrl({ page: next });
          }}
        />
      ) : null}
    </section>
  );
}
