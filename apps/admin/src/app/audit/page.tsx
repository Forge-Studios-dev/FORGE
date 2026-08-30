'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@forge/design-system';
import { DataTable } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { AdminPagination } from '@/components/admin/AdminPagination';

type AuditRow = {
  id: string;
  actorId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor?: { id: string; username: string; displayName: string } | null;
};

const ACTION_CHIPS = ['strike', 'comment', 'user', 'creator', 'copyright'] as const;
const TARGET_TYPES = [
  '',
  'user',
  'comment',
  'video',
  'report',
  'account_strike',
  'stream',
  'community',
] as const;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function targetHref(targetType: string | null, targetId: string): string | null {
  if (targetType === 'user') return `/users/${targetId.split(',')[0]}`;
  if (targetType === 'account_strike' || targetType === 'copyright_counter_notice') return '/copyright';
  if (targetType === 'comment') return '/comments';
  if (targetType === 'video') return `/content?videoId=${encodeURIComponent(targetId)}`;
  if (targetType === 'report') return `/reports/${targetId}`;
  return null;
}

function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parseTargetType(raw: string | null): string {
  if (!raw) return '';
  return (TARGET_TYPES as readonly string[]).includes(raw) ? raw : '';
}

export default function AdminAuditLogPage() {
  return (
    <Suspense fallback={<p className="text-on-surface-variant">Loading audit log…</p>}>
      <AdminAuditLogPageInner />
    </Suspense>
  );
}

function AdminAuditLogPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const actionParam = searchParams.get('action') ?? '';
  const targetTypeParam = searchParams.get('targetType');
  const pageParam = searchParams.get('page');

  const [page, setPage] = useState(() => parsePage(pageParam));
  const [actionDraft, setActionDraft] = useState(actionParam);
  const [actionFilter, setActionFilter] = useState(actionParam.trim());
  const [targetType, setTargetType] = useState(() => parseTargetType(targetTypeParam));

  useEffect(() => {
    setActionDraft(actionParam);
    setActionFilter(actionParam.trim());
    setTargetType(parseTargetType(targetTypeParam));
    setPage(parsePage(pageParam));
  }, [actionParam, targetTypeParam, pageParam]);

  function syncUrl(next: { action?: string; targetType?: string; page?: number }) {
    const params = new URLSearchParams();
    const action = (next.action ?? actionFilter).trim();
    const tt = next.targetType ?? targetType;
    const nextPage = next.page ?? page;
    if (action) params.set('action', action);
    if (tt) params.set('targetType', tt);
    if (nextPage > 1) params.set('page', String(nextPage));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    const next = actionDraft.trim();
    const t = window.setTimeout(() => {
      setActionFilter((prev) => {
        if (prev === next) return prev;
        setPage(1);
        const params = new URLSearchParams();
        if (next) params.set('action', next);
        if (targetType) params.set('targetType', targetType);
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        return next;
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, [actionDraft, pathname, router, targetType]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-audit-log', page, actionFilter, targetType],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '40' });
      if (actionFilter) params.set('action', actionFilter);
      if (targetType) params.set('targetType', targetType);
      const { data } = await api.get(`/admin/audit-log?${params}`);
      return data.data as {
        data: AuditRow[];
        meta: { total: number; page: number; totalPages: number };
      };
    },
  });

  const columns = useMemo<ColumnDef<AuditRow, unknown>[]>(
    () => [
      {
        id: 'when',
        header: 'When',
        cell: ({ row }) => (
          <time className="whitespace-nowrap text-xs text-on-surface-variant" dateTime={row.original.createdAt}>
            {formatWhen(row.original.createdAt)}
          </time>
        ),
      },
      {
        id: 'action',
        header: 'Action',
        cell: ({ row }) => (
          <code className="rounded bg-surface-container px-1.5 py-0.5 text-xs text-on-surface">
            {row.original.action}
          </code>
        ),
      },
      {
        id: 'actor',
        header: 'Actor',
        cell: ({ row }) => {
          const actor = row.original.actor;
          const label = actor?.username
            ? `@${actor.username}`
            : `${row.original.actorId.slice(0, 8)}…`;
          return (
            <Link
              href={`/users/${row.original.actorId}`}
              className="text-xs text-primary hover:underline"
              title={actor?.displayName ?? row.original.actorId}
            >
              {label}
            </Link>
          );
        },
      },
      {
        id: 'target',
        header: 'Target',
        cell: ({ row }) => {
          const { targetType: tt, targetId } = row.original;
          if (!targetId) return <span className="text-xs text-outline">—</span>;
          const href = targetHref(tt, targetId);
          return (
            <div className="max-w-[12rem]">
              {tt ? <p className="text-[10px] uppercase tracking-wide text-outline">{tt}</p> : null}
              {href ? (
                <Link href={href} className="break-all font-mono text-xs text-primary hover:underline">
                  {targetId.length > 36 ? `${targetId.slice(0, 36)}…` : targetId}
                </Link>
              ) : (
                <p className="break-all font-mono text-xs text-on-surface-variant">{targetId}</p>
              )}
            </div>
          );
        },
      },
      {
        id: 'reason',
        header: 'Reason / meta',
        cell: ({ row }) => (
          <div className="max-w-sm text-xs text-on-surface-variant">
            {row.original.reason ? <p className="line-clamp-2">{row.original.reason}</p> : null}
            {row.original.metadata ? (
              <p className="mt-1 line-clamp-2 font-mono text-[10px] text-outline">
                {JSON.stringify(row.original.metadata)}
              </p>
            ) : null}
            {!row.original.reason && !row.original.metadata ? (
              <span className="text-outline">—</span>
            ) : null}
          </div>
        ),
      },
    ],
    [],
  );

  const rows = data?.data ?? [];
  const meta = data?.meta;

  return (
    <section>
      <PageHeader
        title="Audit log"
        subtitle="Privileged admin actions — strikes, appeals, impersonation, bulk updates"
      />

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="audit-action" className="mb-1 block text-xs text-outline">
            Filter by action
          </label>
          <input
            id="audit-action"
            value={actionDraft}
            onChange={(e) => setActionDraft(e.target.value)}
            placeholder="e.g. strike or comment.release"
            className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="audit-target-type" className="mb-1 block text-xs text-outline">
            Target type
          </label>
          <select
            id="audit-target-type"
            value={targetType}
            onChange={(e) => {
              const next = e.target.value;
              setTargetType(next);
              setPage(1);
              syncUrl({ targetType: next, page: 1 });
            }}
            className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm"
          >
            {TARGET_TYPES.map((t) => (
              <option key={t || 'all'} value={t}>
                {t || 'All types'}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="rounded-lg border border-outline-variant px-3 py-2 text-sm hover:border-primary disabled:opacity-50"
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Action shortcuts">
        {ACTION_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => {
              setActionDraft(chip);
              setActionFilter(chip);
              setPage(1);
              syncUrl({ action: chip, page: 1 });
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              actionFilter === chip
                ? 'bg-on-surface text-surface'
                : 'border border-outline-variant/40 text-on-surface-variant hover:border-primary'
            }`}
          >
            {chip}
          </button>
        ))}
        {actionDraft || actionFilter || targetType ? (
          <button
            type="button"
            onClick={() => {
              setActionDraft('');
              setActionFilter('');
              setTargetType('');
              setPage(1);
              router.replace(pathname, { scroll: false });
            }}
            className="rounded-full px-3 py-1 text-xs font-medium text-primary hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="mt-6">
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => r.id}
          loading={isLoading}
          error={
            isError
              ? {
                  title: 'Could not load audit log',
                  description: 'Confirm MFA is enabled and the API is reachable.',
                  onRetry: () => void refetch(),
                }
              : undefined
          }
          emptyState={{
            title: actionFilter || targetType ? 'No matching entries' : 'No audit entries yet',
            description: actionFilter || targetType
              ? 'Try a different action or target type filter.'
              : 'Privileged admin actions will appear here as they happen.',
          }}
        />
        {meta && meta.totalPages > 1 ? (
          <AdminPagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            label="entries"
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
      </div>
    </section>
  );
}
