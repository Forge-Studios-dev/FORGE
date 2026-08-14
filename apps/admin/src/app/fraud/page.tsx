'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button, PageHeader, StatusPill, type StatusTone } from '@forge/design-system';
import { DataTable, Dialog, useToast } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { AdminPagination } from '@/components/admin/AdminPagination';

const PAGE_SIZE = 20;

type FraudAlert = {
  id: string;
  userId: string;
  signal: string;
  riskScore: number;
  status: 'open' | 'under_review' | 'resolved' | 'false_positive';
  metadata: Record<string, unknown>;
  notes: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  under_review: 'Under Review',
  resolved: 'Resolved',
  false_positive: 'False Positive',
};

const STATUS_TONE: Record<string, StatusTone> = {
  open: 'warning',
  under_review: 'primary',
  resolved: 'success',
  false_positive: 'neutral',
};

const RISK_COLOR = (score: number) => {
  if (score >= 80) return 'text-error';
  if (score >= 50) return 'text-warning';
  return 'text-success';
};

export default function FraudPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const dialogTitleId = useId();
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [page, setPage] = useState(1);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [notes, setNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['fraud-alerts', statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      });
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get<{ data: FraudAlert[]; total: number }>(
        `/admin/fraud/alerts?${params}`,
      );
      return res.data;
    },
  });

  const updateAlert = useMutation({
    mutationFn: async ({
      alertId,
      status,
      alertNotes,
    }: {
      alertId: string;
      status: string;
      alertNotes?: string;
    }) => {
      await api.patch(`/admin/fraud/alerts/${alertId}`, { status, notes: alertNotes });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fraud-alerts'] });
      setSelectedAlert(null);
      toast({ title: 'Alert updated', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Could not update alert', variant: 'critical' });
    },
  });

  const runCheck = useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.post(`/admin/fraud/users/${userId}/check`);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: 'Re-check complete', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Re-check failed', variant: 'critical' });
    },
  });

  const alerts = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: ColumnDef<FraudAlert, unknown>[] = [
    {
      accessorKey: 'signal',
      header: 'Signal',
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
    },
    {
      accessorKey: 'riskScore',
      header: 'Risk',
      cell: ({ getValue }) => {
        const score = getValue<number>();
        return <span className={`font-bold ${RISK_COLOR(score)}`}>{score}</span>;
      },
    },
    {
      accessorKey: 'userId',
      header: 'User ID',
      cell: ({ getValue }) => (
        <span className="block max-w-[120px] truncate font-mono text-xs">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const status = getValue<string>();
        return <StatusPill tone={STATUS_TONE[status] ?? 'neutral'} label={STATUS_LABELS[status]} />;
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ getValue }) => (
        <span className="text-xs text-on-surface-variant">
          {new Date(getValue<string>()).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const alert = row.original;
        return (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="!px-2 !py-1 text-xs"
              onClick={() => {
                setSelectedAlert(alert);
                setNotes(alert.notes ?? '');
                setNewStatus(alert.status);
              }}
            >
              Review
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="!px-2 !py-1 text-xs"
              disabled={runCheck.isPending}
              onClick={() => runCheck.mutate(alert.userId)}
            >
              Re-check
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fraud Alerts"
        subtitle="Review risk signals, update case status, and re-run user checks."
      />

      <div className="flex flex-wrap gap-2">
        {(['open', 'under_review', 'resolved', 'false_positive', ''] as const).map((s) => (
          <Button
            key={s || 'all'}
            type="button"
            variant={statusFilter === s ? 'primary' : 'secondary'}
            className="!px-3 !py-1 text-sm"
            onClick={() => setStatusFilter(s)}
          >
            {s ? STATUS_LABELS[s] : 'All'}
          </Button>
        ))}
      </div>

      <DataTable<FraudAlert>
        columns={columns}
        data={alerts}
        getRowId={(alert) => alert.id}
        loading={isLoading}
        emptyState={{ title: 'No alerts found' }}
      />

      {!isLoading && total > 0 ? (
        <AdminPagination
          page={page}
          totalPages={totalPages}
          total={total}
          label="alerts"
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      ) : null}

      <Dialog
        open={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        labelledBy={dialogTitleId}
        size="md"
      >
        {selectedAlert ? (
          <div className="space-y-4">
            <h2 id={dialogTitleId} className="text-lg font-bold text-on-surface">
              Update Alert
            </h2>
            <div className="text-sm text-on-surface-variant">
              <p>
                <span className="text-on-surface">Signal:</span> {selectedAlert.signal}
              </p>
              <p>
                <span className="text-on-surface">Risk Score:</span> {selectedAlert.riskScore}
              </p>
              <p>
                <span className="text-on-surface">User:</span> {selectedAlert.userId}
              </p>
              {Object.keys(selectedAlert.metadata).length > 0 ? (
                <pre className="mt-2 max-h-32 overflow-auto rounded bg-surface-container-high p-2 text-xs">
                  {JSON.stringify(selectedAlert.metadata, null, 2)}
                </pre>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-on-surface" htmlFor="fraud-status">
                Status
              </label>
              <select
                id="fraud-status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface"
              >
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-on-surface" htmlFor="fraud-notes">
                Notes
              </label>
              <textarea
                id="fraud-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface"
                placeholder="Internal notes..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setSelectedAlert(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={updateAlert.isPending}
                onClick={() =>
                  updateAlert.mutate({
                    alertId: selectedAlert.id,
                    status: newStatus,
                    alertNotes: notes,
                  })
                }
              >
                {updateAlert.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
