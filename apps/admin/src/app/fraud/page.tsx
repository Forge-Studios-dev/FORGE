'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';

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

const RISK_COLOR = (score: number) => {
  if (score >= 80) return 'text-error';
  if (score >= 50) return 'text-warning';
  return 'text-success';
};

export default function FraudPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [notes, setNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['fraud-alerts', statusFilter],
    queryFn: async () => {
      const params = statusFilter ? `?status=${statusFilter}&limit=100` : '?limit=100';
      const res = await api.get<{ data: FraudAlert[] }>(`/admin/fraud/alerts${params}`);
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
    },
  });

  const runCheck = useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.post(`/admin/fraud/users/${userId}/check`);
      return res.data;
    },
  });

  const alerts = data?.data ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-on-surface">Fraud Alerts</h1>
        <div className="flex flex-wrap gap-2">
          {(['open', 'under_review', 'resolved', 'false_positive', ''] as const).map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded px-3 py-1 text-sm ${
                statusFilter === s
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              {s ? STATUS_LABELS[s] : 'All'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="overflow-x-auto" aria-busy="true" aria-label="Loading fraud alerts">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/40 text-left text-on-surface-variant">
                <th className="pb-2 pr-4">Signal</th>
                <th className="pb-2 pr-4">Risk</th>
                <th className="pb-2 pr-4">User ID</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Created</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-3 pr-4">
                    <div className="h-3 w-24 rounded bg-surface-container-high" />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="h-3 w-8 rounded bg-surface-container-high" />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="h-3 w-20 rounded bg-surface-container-high" />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="h-4 w-16 rounded bg-surface-container-high" />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="h-3 w-16 rounded bg-surface-container-high" />
                  </td>
                  <td className="py-3">
                    <div className="h-6 w-20 rounded bg-surface-container-high" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-on-surface-variant">No alerts found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/40 text-left text-on-surface-variant">
                <th className="pb-2 pr-4">Signal</th>
                <th className="pb-2 pr-4">Risk</th>
                <th className="pb-2 pr-4">User ID</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Created</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {alerts.map((alert) => (
                <tr key={alert.id} className="text-on-surface">
                  <td className="py-3 pr-4 font-mono text-xs">{alert.signal}</td>
                  <td className={`py-3 pr-4 font-bold ${RISK_COLOR(alert.riskScore)}`}>
                    {alert.riskScore}
                  </td>
                  <td className="max-w-[120px] truncate py-3 pr-4 font-mono text-xs">
                    {alert.userId}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="rounded bg-surface-container-high px-2 py-0.5 text-xs">
                      {STATUS_LABELS[alert.status]}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs text-on-surface-variant">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </td>
                  <td className="flex gap-2 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAlert(alert);
                        setNotes(alert.notes ?? '');
                        setNewStatus(alert.status);
                      }}
                      className="rounded bg-surface-container-high px-2 py-1 text-xs hover:bg-surface-container-highest"
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      onClick={() => runCheck.mutate(alert.userId)}
                      className="rounded bg-surface-container-high px-2 py-1 text-xs hover:bg-surface-container-highest"
                    >
                      Re-check
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70">
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-outline-variant/40 bg-surface-container p-6">
            <h2 className="text-lg font-bold text-on-surface">Update Alert</h2>
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
              {Object.keys(selectedAlert.metadata).length > 0 && (
                <pre className="mt-2 max-h-32 overflow-auto rounded bg-surface-container-high p-2 text-xs">
                  {JSON.stringify(selectedAlert.metadata, null, 2)}
                </pre>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-on-surface">Status</label>
              <select
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
              <label className="block text-sm text-on-surface">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface"
                placeholder="Internal notes..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="rounded bg-surface-container-high px-4 py-2 text-sm text-on-surface hover:bg-surface-container-highest"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  updateAlert.mutate({
                    alertId: selectedAlert.id,
                    status: newStatus,
                    alertNotes: notes,
                  })
                }
                disabled={updateAlert.isPending}
                className="rounded bg-primary px-4 py-2 text-sm text-on-primary hover:opacity-90 disabled:opacity-50"
              >
                {updateAlert.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
