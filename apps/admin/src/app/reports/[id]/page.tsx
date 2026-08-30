'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, PageHeader } from '@forge/design-system';
import { ConfirmDialog } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { env } from '@/env';

type ReportTarget =
  | {
      kind: 'comment';
      id: string;
      videoId: string;
      videoTitle?: string | null;
      content: string;
      moderationStatus?: string;
      deletedAt?: string | null;
      author?: { id: string; username: string; displayName?: string } | null;
    }
  | {
      kind: 'video';
      id: string;
      title: string;
      userId: string;
      moderationStatus?: string;
    }
  | {
      kind: 'user';
      id: string;
      username: string;
      displayName?: string;
      email?: string;
    };

type Report = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  reasonCategory?: string | null;
  severity?: string;
  status: string;
  createdAt: string;
  reporter?: { id: string; username: string; email: string };
  target?: ReportTarget | null;
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
  const [pendingConfirm, setPendingConfirm] = useState<
    'dismiss' | 'block-video' | 'remove-comment' | null
  >(null);

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

  const removeCommentAndReview = async () => {
    const commentId = report?.targetType === 'comment' ? report.targetId : null;
    if (!commentId) return;
    setActionPending(true);
    setActionError(null);
    try {
      await api.delete(`/admin/comments/${commentId}`);
      await runUpdateStatus('reviewed');
    } catch {
      setActionError('Could not remove comment. Please try again.');
      setActionPending(false);
    }
  };

  const webBase = env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
  const commentTarget = report?.target?.kind === 'comment' ? report.target : null;
  const videoTarget = report?.target?.kind === 'video' ? report.target : null;
  const targetHref =
    report?.targetType === 'video'
      ? `${webBase}/watch/${report.targetId}`
      : commentTarget
        ? `${webBase}/watch/${commentTarget.videoId}?lc=${encodeURIComponent(commentTarget.id)}`
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

  const commentAlreadyGone = !!commentTarget?.deletedAt;

  return (
    <section>
      <Link href="/reports" className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Reports
      </Link>
      <PageHeader title={`Report #${report.id.slice(0, 8)}`} subtitle={report.targetType} />
      <div className="glass-panel mb-6 space-y-3 rounded-xl p-6">
        <p>
          <span className="text-outline">Severity:</span>{' '}
          <span className="font-semibold uppercase">{(report.severity ?? 'p3').toUpperCase()}</span>
          {report.reasonCategory ? (
            <span className="text-on-surface-variant"> · {report.reasonCategory}</span>
          ) : null}
        </p>
        <p>
          <span className="text-outline">Target:</span>{' '}
          {targetHref ? (
            <a href={targetHref} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {report.targetType === 'comment'
                ? `Comment on ${commentTarget?.videoTitle ?? 'video'} · ${report.targetId.slice(0, 8)}…`
                : videoTarget
                  ? `${videoTarget.title} · ${report.targetId.slice(0, 8)}…`
                  : `${report.targetType} · ${report.targetId.slice(0, 8)}…`}
            </a>
          ) : (
            <>
              {report.targetType} · {report.targetId}
            </>
          )}
        </p>
        {commentTarget ? (
          <>
            <p>
              <span className="text-outline">Comment:</span>{' '}
              <span className="whitespace-pre-wrap">{commentTarget.content}</span>
            </p>
            {commentTarget.author ? (
              <p>
                <span className="text-outline">Author:</span>{' '}
                <Link
                  href={`/users/${commentTarget.author.id}`}
                  className="text-primary hover:underline"
                >
                  @{commentTarget.author.username}
                </Link>
              </p>
            ) : null}
            {commentTarget.moderationStatus === 'held' ? (
              <p className="text-sm text-error">Currently held for review</p>
            ) : null}
            {commentAlreadyGone ? (
              <p className="text-sm text-on-surface-variant">Comment already removed</p>
            ) : null}
          </>
        ) : null}
        {videoTarget ? (
          <p>
            <span className="text-outline">Video title:</span> {videoTarget.title}
          </p>
        ) : null}
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
        {report.targetType === 'comment' ? (
          <>
            <button
              type="button"
              disabled={actionPending || commentAlreadyGone || report.status !== 'pending'}
              onClick={() => setPendingConfirm('remove-comment')}
              className="rounded-full border border-error/40 px-6 py-2 text-sm text-error hover:bg-error/10 disabled:opacity-40"
            >
              {actionPending ? 'Working…' : 'Remove comment'}
            </button>
            <Link
              href="/comments"
              className="rounded-full border border-outline-variant px-6 py-2 text-sm hover:border-primary"
            >
              Held comments queue
            </Link>
          </>
        ) : null}
        <Button
          type="button"
          variant="primary"
          disabled={report.status !== 'pending' || actionPending}
          onClick={() => updateStatus('reviewed')}
        >
          {actionPending ? 'Working…' : 'Mark reviewed'}
        </Button>
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
            : pendingConfirm === 'remove-comment'
              ? 'Remove this comment and mark report reviewed?'
              : 'Dismiss this report without further action?'
        }
        confirmLabel={
          pendingConfirm === 'block-video'
            ? 'Block video'
            : pendingConfirm === 'remove-comment'
              ? 'Remove comment'
              : 'Dismiss'
        }
        variant="danger"
        loading={actionPending}
        onConfirm={() => {
          const action = pendingConfirm;
          setPendingConfirm(null);
          if (action === 'block-video') void blockVideoAndReview();
          else if (action === 'remove-comment') void removeCommentAndReview();
          else if (action === 'dismiss') void runUpdateStatus('dismissed');
        }}
        onCancel={() => setPendingConfirm(null)}
      />
    </section>
  );
}
