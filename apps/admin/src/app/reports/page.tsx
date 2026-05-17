'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';

type Report = {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
  reporter?: { username: string; email: string };
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/reports', { params: { limit: 50 } });
      const payload = res.data.data as { data: Report[] };
      setReports(payload.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return <p className="text-on-surface-variant">Loading reports…</p>;
  }

  if (error) {
    return (
      <section className="space-y-4">
        <p className="text-error">{error}</p>
        <button type="button" onClick={() => void load()} className="text-sm text-primary hover:underline">
          Retry
        </button>
      </section>
    );
  }

  return (
    <section>
      <PageHeader title="Reports" subtitle="User and content reports from the platform" />

      {reports.length === 0 ? (
        <p className="glass-panel rounded-xl p-8 text-center text-on-surface-variant">No reports in the inbox.</p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id}>
              <Link
                href={`/reports/${r.id}`}
                className="glass-panel block rounded-xl p-4 transition hover:border-primary/30"
              >
                <div className="mb-2 flex flex-wrap gap-2 text-xs text-outline">
                  <span className="font-medium text-on-surface">{r.targetType}</span>
                  <span>·</span>
                  <span>{r.status}</span>
                  <span>·</span>
                  <span>{new Date(r.createdAt).toLocaleString()}</span>
                </div>
                <p className="line-clamp-2 text-sm text-on-surface-variant">{r.reason}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
