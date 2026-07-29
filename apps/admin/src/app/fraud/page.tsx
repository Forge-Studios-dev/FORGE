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
  if (score >= 80) return 'text-red-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-green-400';
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
    mutationFn: async ({ alertId, status, alertNotes }: { alertId: string; status: string; alertNotes?: string }) => {
      await api.patch(`/admin/fraud/alerts/${alertId}`, { status, notes: alertNotes });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fraud-alerts'] });
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Fraud Alerts</h1>
        <div className="flex gap-2">
          {(['open', 'under_review', 'resolved', 'false_positive', ''] as const).map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded text-sm ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
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
              <tr className="text-left text-zinc-400 border-b border-zinc-700">
                <th className="pb-2 pr-4">Signal</th>
                <th className="pb-2 pr-4">Risk</th>
                <th className="pb-2 pr-4">User ID</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Created</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-3 pr-4"><div className="h-3 w-24 rounded bg-zinc-700" /></td>
                  <td className="py-3 pr-4"><div className="h-3 w-8 rounded bg-zinc-700" /></td>
                  <td className="py-3 pr-4"><div className="h-3 w-20 rounded bg-zinc-700" /></td>
                  <td className="py-3 pr-4"><div className="h-4 w-16 rounded bg-zinc-700" /></td>
                  <td className="py-3 pr-4"><div className="h-3 w-16 rounded bg-zinc-700" /></td>
                  <td className="py-3"><div className="h-6 w-20 rounded bg-zinc-700" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-zinc-400">No alerts found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-400 border-b border-zinc-700">
                <th className="pb-2 pr-4">Signal</th>
                <th className="pb-2 pr-4">Risk</th>
                <th className="pb-2 pr-4">User ID</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Created</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {alerts.map((alert) => (
                <tr key={alert.id} className="text-zinc-200">
                  <td className="py-3 pr-4 font-mono text-xs">{alert.signal}</td>
                  <td className={`py-3 pr-4 font-bold ${RISK_COLOR(alert.riskScore)}`}>{alert.riskScore}</td>
                  <td className="py-3 pr-4 font-mono text-xs truncate max-w-[120px]">{alert.userId}</td>
                  <td className="py-3 pr-4">
                    <span className="px-2 py-0.5 rounded bg-zinc-700 text-xs">{STATUS_LABELS[alert.status]}</span>
                  </td>
                  <td className="py-3 pr-4 text-zinc-400 text-xs">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 flex gap-2">
                    <button
                      onClick={() => { setSelectedAlert(alert); setNotes(alert.notes ?? ''); setNewStatus(alert.status); }}
                      className="text-xs px-2 py-1 bg-zinc-700 rounded hover:bg-zinc-600"
                    >
                      Review
                    </button>
                    <button
                      onClick={() => runCheck.mutate(alert.userId)}
                      className="text-xs px-2 py-1 bg-zinc-700 rounded hover:bg-zinc-600"
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-lg space-y-4 border border-zinc-700">
            <h2 className="text-lg font-bold text-white">Update Alert</h2>
            <div className="text-sm text-zinc-400">
              <p><span className="text-zinc-300">Signal:</span> {selectedAlert.signal}</p>
              <p><span className="text-zinc-300">Risk Score:</span> {selectedAlert.riskScore}</p>
              <p><span className="text-zinc-300">User:</span> {selectedAlert.userId}</p>
              {Object.keys(selectedAlert.metadata).length > 0 && (
                <pre className="mt-2 text-xs bg-zinc-800 rounded p-2 overflow-auto max-h-32">
                  {JSON.stringify(selectedAlert.metadata, null, 2)}
                </pre>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-zinc-300">Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
              >
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-zinc-300">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm resize-none"
                placeholder="Internal notes..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setSelectedAlert(null)}
                className="px-4 py-2 text-sm bg-zinc-700 rounded hover:bg-zinc-600 text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => updateAlert.mutate({ alertId: selectedAlert.id, status: newStatus, alertNotes: notes })}
                disabled={updateAlert.isPending}
                className="px-4 py-2 text-sm bg-blue-600 rounded hover:bg-blue-500 text-white disabled:opacity-50"
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
