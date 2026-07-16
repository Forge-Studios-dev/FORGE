'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader, StatusPill } from '@forge/design-system';
import { DataTable } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { AdminPagination } from '@/components/admin/AdminPagination';

interface LedgerRow {
  id: string;
  type: 'subscription' | 'event_purchase';
  userId: string;
  username: string;
  displayName: string;
  creatorId: string;
  creatorUsername: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'critical' | 'neutral'> = {
  active: 'success',
  trial: 'success',
  completed: 'success',
  grace_period: 'warning',
  renewal_pending: 'warning',
  failed_payment: 'critical',
  canceled: 'neutral',
  expired: 'neutral',
  paused: 'neutral',
  suspended: 'critical',
  refunded: 'warning',
};

export default function BillingPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-billing-ledger', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const { data } = await api.get(`/admin/billing/transactions?${params}`);
      return data.data as { data: LedgerRow[]; meta: { total: number; page: number; totalPages: number } };
    },
  });

  const columns = useMemo<ColumnDef<LedgerRow, unknown>[]>(
    () => [
      {
        id: 'member',
        header: 'Member',
        cell: ({ row }) => (
          <Link href={`/users/${row.original.userId}`} className="group block">
            <p className="group-hover:text-primary">{row.original.displayName}</p>
            <p className="text-xs text-outline group-hover:text-primary">@{row.original.username}</p>
          </Link>
        ),
      },
      {
        id: 'creator',
        header: 'Creator',
        cell: ({ row }) => (
          <Link href={`/users/${row.original.creatorId}`} className="text-on-surface-variant hover:text-primary">
            @{row.original.creatorUsername}
          </Link>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ getValue }) => (
          <span className="text-xs text-on-surface-variant">
            {getValue<string>() === 'subscription' ? 'Subscription' : 'Event purchase'}
          </span>
        ),
      },
      {
        id: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {row.original.currency} {(row.original.amountCents / 100).toFixed(2)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue<string>();
          return <StatusPill tone={STATUS_TONE[status] ?? 'neutral'} label={status.replace(/_/g, ' ')} />;
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Date',
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
        <PageHeader title="Billing" subtitle="Cross-creator transaction ledger" />
        <p className="text-error">Failed to load transactions.</p>
        <button type="button" onClick={() => refetch()} className="mt-4 text-sm text-primary hover:underline">
          Retry
        </button>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Billing"
          subtitle="Subscriptions and paid-event purchases across every creator — read-only, for support and dispute lookups"
        />
        <AdminSearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by member or creator username…"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        getRowId={(r) => r.id}
        loading={isLoading}
        emptyState={{ title: 'No transactions found', description: 'Try a different search.' }}
      />
      {data?.meta ? (
        <AdminPagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          label="transactions"
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      ) : null}
    </section>
  );
}
