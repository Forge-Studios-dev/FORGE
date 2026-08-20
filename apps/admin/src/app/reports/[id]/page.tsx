'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageHeader } from '@forge/design-system';
import { ConfirmDialog } from '@forge/design-system/client';
import { api } from '@/lib/api';

type Report = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
  reporter?: { id: string; username: string; email: string };
};

export default function ReportDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<'dismiss' | 'block-video' | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get(`/admin/reports/${id}`);
      setReport(res.data.data as Report);
    } catch {
      setLoadError('Report not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const runUpdateStatus = async (status: 'reviewed' | 'dismissed') => {
    setActionPending(true);
    setActionError(null);
    try {
      await api.patch(`/admin/reports/${id}`, { status });
      setDone(true);
    } catch {
      setActionError('Could not update report. Please try again.');
    } finally {
      setActionPending(false);
    }
  };

  const updateStatus = (status: 'reviewed' | 'dismissed') => {
    if (status === 'dismissed') {
      setPendingConfirm('dismiss');
      return;
    }
    void runUpdateStatus(status);
  };

  const blockVideoAndReview = async () => {
    setActionPending(true);
    setActionError(null);
    try {
      await api.patch(`/admin/videos/${report!.targetId}`, {
        moderationStatus: 'blocked',
        visibility: 'private',
      });
      await runUpdateStatus('reviewed');
    } catch {
      setActionError('Could not block video. Please try again.');
      setActionPending(false);
    }
  };

  const webBase = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
  const targetHref =
    report?.targetType === 'video'
      ? `${webBase}/watch/${report.targetId}`
      : null;

  if (loading) {
    return <p className="text-on-surface-variant">Loading report…</p>;
  }

  if (loadError || !report) {
    return (
      <section>
        <p className="text-error">{loadError ?? 'Not found'}</p>
        <Link href="/reports" className="mt-4 inline-block text-sm text-primary">
          ← Back to reports
        </Link>
      </section>
    );
  }

  if (done) {
    return (
      <section>
        <p className="glass-panel rounded-xl p-8 text-center">Report updated.</p>
        <Link href="/reports" className="mt-4 inline-block text-primary">
          ← Back to inbox
        </Link>
      </section>
    );
  }

  return (
    <section>
      <Link href="/reports" className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Reports
      </Link>
      <PageHeader title={`Report #${report.id.slice(0, 8)}`} subtitle={report.targetType} />
      <div className="glass-panel mb-6 space-y-3 rounded-xl p-6">
        <p>
          <span className="text-outline">Target:</span>{' '}
          {targetHref ? (
            <a href={targetHref} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {report.targetType} · {report.targetId.slice(0, 8)}…
            </a>
          ) : (
            <>
              {report.targetType} · {report.targetId}
            </>
          )}
        </p>
        <p>
          <span className="text-outline">Status:</span> {report.status}
        </p>
        <p>
          <span className="text-outline">Submitted:</span> {new Date(report.createdAt).toLocaleString()}
        </p>
        {report.reporter && (
          <p>
            <span className="text-outline">Reporter:</span>{' '}
            <Link href={`/users/${report.reporter.id}`} className="text-primary hover:underline">
              @{report.reporter.username}
            </Link>{' '}
            ({report.reporter.email})
          </p>
        )}
        {report.targetType === 'user' && (
          <p>
            <span className="text-outline">Reported user:</span>{' '}
            <Link href={`/users/${report.targetId}`} className="text-primary hover:underline">
              View profile
            </Link>
          </p>
        )}
        <p className="whitespace-pre-wrap border-t border-outline-variant/20 pt-3">{report.reason}</p>
      </div>
      {actionError ? <p className="mb-3 text-sm text-error">{actionError}</p> : null}
      <div className="flex flex-wrap gap-3">
        {report.targetType === 'video' ? (
          <>
            <button
              type="button"
              disabled={actionPending}
              onClick={() => setPendingConfirm('block-video')}
              className="rounded-full border border-error/40 px-6 py-2 text-sm text-error hover:bg-error/10 disabled:opacity-40"
            >
              {actionPending ? 'Working…' : 'Block video'}
            </button>
            <Link
              href="/content?moderationStatus=held"
              className="rounded-full border border-outline-variant px-6 py-2 text-sm hover:border-primary"
            >
              Moderation queue
            </Link>
          </>
        ) : null}
        <button
          type="button"
          disabled={report.status !== 'pending' || actionPending}
          onClick={() => updateStatus('reviewed')}
          className="primary-button rounded-full px-6 py-2 text-sm font-semibold text-on-primary disabled:opacity-40"
        >
          {actionPending ? 'Working…' : 'Mark reviewed'}
        </button>
        <button
          type="button"
          disabled={report.status !== 'pending' || actionPending}
          onClick={() => updateStatus('dismissed')}
          className="rounded-full border border-outline-variant px-6 py-2 text-sm hover:border-primary disabled:opacity-40"
        >
          {actionPending ? 'Working…' : 'Dismiss report'}
        </button>
      </div>

      <ConfirmDialog
        open={pendingConfirm !== null}
        title={
          pendingConfirm === 'block-video'
            ? 'Block this video and mark report reviewed?'
            : 'Dismiss this report without further action?'
        }
        confirmLabel={pendingConfirm === 'block-video' ? 'Block video' : 'Dismiss'}
        variant="danger"
        loading={actionPending}
        onConfirm={() => {
          const action = pendingConfirm;
          setPendingConfirm(null);
          if (action === 'block-video') void blockVideoAndReview();
          else if (action === 'dismiss') void runUpdateStatus('dismissed');
        }}
        onCancel={() => setPendingConfirm(null)}
      />
    </section>
  );
}
