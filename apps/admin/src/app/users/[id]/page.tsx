'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { StatusPill, type StatusTone } from '@forge/design-system';
import { ConfirmDialog, DataTable, Dialog, Tabs, useToast } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { AdminPagination } from '@/components/admin/AdminPagination';
import type {
  AdminPlaylist,
  AdminReport,
  AdminUser,
  AdminUserSummary,
  AdminVideo,
} from '@/lib/admin-user-types';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'videos', label: 'Videos' },
  { id: 'reports', label: 'Reports' },
  { id: 'activity', label: 'Watch history' },
  { id: 'playlists', label: 'Playlists' },
] as const;

type TabId = (typeof TABS)[number]['id'];

type PendingConfirm =
  | { kind: 'role'; role: string }
  | { kind: 'block'; nextActive: boolean }
  | { kind: 'delete' }
  | { kind: 'impersonate'; url: string; targetName: string; expiresInSeconds: number };

const ROLE_TONE: Record<string, StatusTone> = {
  admin: 'critical',
  creator: 'primary',
  user: 'neutral',
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = params.id as string;
  const tab = (searchParams.get('tab') as TabId) || 'overview';
  const qc = useQueryClient();
  const webBase = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
  const { toast } = useToast();

  const [videoPage, setVideoPage] = useState(1);
  const [videoStatus, setVideoStatus] = useState('');
  const [reportPage, setReportPage] = useState(1);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [grantAdminOpen, setGrantAdminOpen] = useState(false);
  const [grantAdminError, setGrantAdminError] = useState<string | null>(null);

  const { data: summary, isLoading, isError } = useQuery({
    queryKey: ['admin-user-summary', userId],
    queryFn: async () => {
      const { data } = await api.get<{ data: AdminUserSummary }>(`/admin/users/${userId}/summary`);
      return data.data;
    },
  });

  const user = summary?.user;

  const updateUser = useMutation({
    mutationFn: (body: {
      role?: string;
      isVerified?: boolean;
      isActive?: boolean;
      currentAdminPassword?: string;
    }) => api.patch(`/admin/users/${userId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-user-summary', userId] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setPendingConfirm(null);
    },
  });

  const deleteUser = useMutation({
    mutationFn: () => api.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      router.push('/users');
    },
  });

  const resendVerification = useMutation({
    mutationFn: () => api.post(`/admin/users/${userId}/resend-verification`),
    onSuccess: () => {
      toast({ title: 'Verification email sent', description: '(if SMTP is configured)', variant: 'success' });
    },
  });

  const approveCreator = useMutation({
    mutationFn: () => api.post(`/admin/creators/${userId}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-user-summary', userId] }),
  });

  const rejectCreator = useMutation({
    mutationFn: (note?: string) => api.post(`/admin/creators/${userId}/reject`, { note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-user-summary', userId] }),
  });

  const impersonate = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{
        data: { url: string; expiresInSeconds: number; targetUser: { displayName: string } };
      }>(`/admin/users/${userId}/impersonate`);
      return data.data;
    },
    onSuccess: (result) => {
      setPendingConfirm({
        kind: 'impersonate',
        url: result.url,
        targetName: result.targetUser.displayName,
        expiresInSeconds: result.expiresInSeconds,
      });
    },
  });

  const updateVideo = useMutation({
    mutationFn: ({ id, status, visibility }: { id: string; status?: string; visibility?: string }) =>
      api.patch(`/admin/videos/${id}`, { status, visibility }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-user-videos', userId] });
      qc.invalidateQueries({ queryKey: ['admin-user-summary', userId] });
      qc.invalidateQueries({ queryKey: ['admin-videos'] });
    },
  });

  const { data: videosData, isLoading: videosLoading } = useQuery({
    queryKey: ['admin-user-videos', userId, videoPage, videoStatus],
    enabled: tab === 'videos',
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(videoPage), limit: '15' });
      if (videoStatus) params.set('status', videoStatus);
      const { data } = await api.get(`/admin/users/${userId}/videos?${params}`);
      return data.data as { data: AdminVideo[]; meta: { page: number; totalPages: number; total: number } };
    },
  });

  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['admin-user-reports', userId, reportPage],
    enabled: tab === 'reports',
    queryFn: async () => {
      const { data } = await api.get(
        `/admin/users/${userId}/reports?page=${reportPage}&limit=15`,
      );
      return data.data as { data: AdminReport[]; meta: { page: number; totalPages: number; total: number } };
    },
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['admin-user-history', userId],
    enabled: tab === 'activity',
    queryFn: async () => {
      const { data } = await api.get<{
        data: { data: { video: AdminVideo; progressSeconds: number }[] };
      }>(`/admin/users/${userId}/watch-history?limit=20`);
      return data.data.data.map((row) => row.video);
    },
  });

  const { data: playlists, isLoading: playlistsLoading } = useQuery({
    queryKey: ['admin-user-playlists', userId],
    enabled: tab === 'playlists',
    queryFn: async () => {
      const { data } = await api.get<{ data: AdminPlaylist[] }>(`/admin/users/${userId}/playlists`);
      return data.data;
    },
  });

  const setTab = (id: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', id);
    router.replace(`/users/${userId}?${next.toString()}`);
  };

  if (isLoading) {
    return <p className="text-on-surface-variant">Loading user…</p>;
  }

  if (isError || !user) {
    return (
      <section>
        <p className="text-error">User not found.</p>
        <Link href="/users" className="mt-4 inline-block text-sm text-primary">
          ← Back to users
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <Link href="/users" className="text-sm text-primary hover:underline">
        ← All users
      </Link>

      <UserHeader
        user={user}
        summary={summary}
        webBase={webBase}
        onRoleChange={(role) => {
          if (role === 'admin') {
            setGrantAdminError(null);
            setGrantAdminOpen(true);
            return;
          }
          setPendingConfirm({ kind: 'role', role });
        }}
        onVerifyToggle={() => updateUser.mutate({ isVerified: !user.isVerified })}
        onBlockToggle={() =>
          setPendingConfirm({ kind: 'block', nextActive: user.isActive === false })
        }
        onDelete={() => setPendingConfirm({ kind: 'delete' })}
        onResendVerification={() => resendVerification.mutate()}
        onApprove={() => approveCreator.mutate()}
        onReject={() => setShowRejectDialog(true)}
        onImpersonate={() => impersonate.mutate()}
        isImpersonating={impersonate.isPending}
        isDeleting={deleteUser.isPending}
        isResending={resendVerification.isPending}
      />

      <ConfirmDialog
        open={pendingConfirm !== null}
        title={
          pendingConfirm?.kind === 'role'
            ? `Change @${user.username} role to ${pendingConfirm.role}?`
            : pendingConfirm?.kind === 'block'
              ? pendingConfirm.nextActive
                ? `Unblock @${user.username}?`
                : `Block @${user.username}? They will be signed out and cannot log in.`
              : pendingConfirm?.kind === 'delete'
                ? `Permanently remove @${user.username}? This soft-deletes the account and frees the email for a new signup.`
                : pendingConfirm?.kind === 'impersonate'
                  ? `Open web as ${pendingConfirm.targetName}? Link expires in ${pendingConfirm.expiresInSeconds}s.`
                  : ''
        }
        confirmLabel={pendingConfirm?.kind === 'impersonate' ? 'Open' : 'Confirm'}
        variant="danger"
        loading={updateUser.isPending || deleteUser.isPending}
        onConfirm={() => {
          if (!pendingConfirm) return;
          if (pendingConfirm.kind === 'role') updateUser.mutate({ role: pendingConfirm.role });
          else if (pendingConfirm.kind === 'block')
            updateUser.mutate({ isActive: pendingConfirm.nextActive });
          else if (pendingConfirm.kind === 'delete') deleteUser.mutate();
          else if (pendingConfirm.kind === 'impersonate') {
            window.open(pendingConfirm.url, '_blank', 'noopener,noreferrer');
            setPendingConfirm(null);
          }
        }}
        onCancel={() => setPendingConfirm(null)}
      />

      <RejectNoteDialog
        open={showRejectDialog}
        loading={rejectCreator.isPending}
        onCancel={() => setShowRejectDialog(false)}
        onConfirm={(note) => {
          rejectCreator.mutate(note, { onSuccess: () => setShowRejectDialog(false) });
        }}
      />

      <GrantAdminDialog
        open={grantAdminOpen}
        username={user.username}
        loading={updateUser.isPending}
        error={grantAdminError}
        onCancel={() => {
          setGrantAdminOpen(false);
          setGrantAdminError(null);
        }}
        onConfirm={(password) => {
          setGrantAdminError(null);
          updateUser.mutate(
            { role: 'admin', currentAdminPassword: password },
            {
              onSuccess: () => setGrantAdminOpen(false),
              onError: (err) => {
                const message =
                  isAxiosError<{ message?: string | string[] }>(err) &&
                  err.response?.data?.message
                    ? err.response.data.message
                    : 'Could not grant admin role.';
                setGrantAdminError(Array.isArray(message) ? message[0] : message);
              },
            },
          );
        }}
      />

      <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <OverviewTab user={user} summary={summary} webBase={webBase} onNavigateTab={setTab} />
      )}
      {tab === 'videos' && (
        <VideosTab
          videos={videosData?.data}
          meta={videosData?.meta}
          isLoading={videosLoading}
          statusFilter={videoStatus}
          onStatusChange={(s) => {
            setVideoStatus(s);
            setVideoPage(1);
          }}
          page={videoPage}
          onPageChange={setVideoPage}
          webBase={webBase}
          isModerating={updateVideo.isPending}
          onUpdateVideo={(id, patch) => updateVideo.mutate({ id, ...patch })}
        />
      )}
      {tab === 'reports' && (
        <ReportsTab
          userId={userId}
          reports={reportsData?.data}
          meta={reportsData?.meta}
          isLoading={reportsLoading}
          page={reportPage}
          onPageChange={setReportPage}
          webBase={webBase}
        />
      )}
      {tab === 'activity' && (
        <ActivityTab videos={historyData} isLoading={historyLoading} webBase={webBase} />
      )}
      {tab === 'playlists' && (
        <PlaylistsTab playlists={playlists} isLoading={playlistsLoading} webBase={webBase} />
      )}
    </section>
  );
}

function UserHeader({
  user,
  summary,
  webBase,
  onRoleChange,
  onVerifyToggle,
  onBlockToggle,
  onDelete,
  onResendVerification,
  onApprove,
  onReject,
  onImpersonate,
  isImpersonating,
  isDeleting,
  isResending,
}: {
  user: AdminUser;
  summary: AdminUserSummary;
  webBase: string;
  onRoleChange: (role: string) => void;
  onVerifyToggle: () => void;
  onBlockToggle: () => void;
  onDelete: () => void;
  onResendVerification: () => void;
  onApprove: () => void;
  onReject: () => void;
  onImpersonate: () => void;
  isImpersonating?: boolean;
  isDeleting?: boolean;
  isResending?: boolean;
}) {
  return (
    <div className="glass-panel rounded-2xl p-6 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-variant/30 bg-surface-container-high text-2xl font-bold text-primary">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            user.displayName[0]?.toUpperCase() ?? '?'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display-forge text-2xl font-bold">{user.displayName}</h1>
            <StatusPill tone={ROLE_TONE[user.role] ?? ROLE_TONE.user} label={user.role} />
            {user.creatorStatus ? (
              <StatusPill tone="reward" label={`creator: ${user.creatorStatus}`} />
            ) : null}
            {user.isActive === false ? <StatusPill tone="critical" label="blocked" /> : null}
            {user.isVerified ? (
              <StatusPill tone="success" label="email verified" />
            ) : (
              <StatusPill tone="warning" label="email not verified" />
            )}
          </div>
          <p className="mt-1 text-on-surface-variant">@{user.username} · {user.email}</p>
          {user.bio ? <p className="mt-3 text-sm text-on-surface-variant">{user.bio}</p> : null}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-on-surface-variant">
            <span>{user.followerCount} subscribers</span>
            <span>{user.followingCount} subscriptions</span>
            <span>{user.videoCount} videos</span>
            <span>{summary.playlistCount} playlists</span>
            {summary.pendingReports > 0 ? (
              <span className="text-error">{summary.pendingReports} pending reports</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
          <a
            href={`${webBase}/${user.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-outline-variant px-4 py-2 text-center text-xs hover:border-primary"
          >
            View on web
          </a>
          {user.role !== 'admin' ? (
            <button
              type="button"
              disabled={isImpersonating}
              onClick={onImpersonate}
              className="rounded-full border border-secondary/40 px-4 py-2 text-center text-xs text-secondary hover:bg-secondary/10 disabled:opacity-50"
            >
              {isImpersonating ? 'Opening…' : 'Sign in as user'}
            </button>
          ) : null}
          <select
            value={user.role}
            onChange={(e) => onRoleChange(e.target.value)}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-xs"
          >
            <option value="user">user</option>
            <option value="creator">creator</option>
            <option value="admin">admin</option>
          </select>
          <button
            type="button"
            onClick={onVerifyToggle}
            className="rounded-full border border-outline-variant px-4 py-2 text-xs hover:border-primary"
          >
            {user.isVerified ? 'Mark unverified' : 'Mark verified'}
          </button>
          {!user.isVerified ? (
            <button
              type="button"
              disabled={isResending}
              onClick={onResendVerification}
              className="rounded-full border border-outline-variant px-4 py-2 text-xs hover:border-primary disabled:opacity-50"
            >
              {isResending ? 'Sending…' : 'Resend verification email'}
            </button>
          ) : null}
          {user.role !== 'admin' ? (
            <>
              <button
                type="button"
                onClick={onBlockToggle}
                className="rounded-full border border-error/40 px-4 py-2 text-xs text-error hover:bg-error/10"
              >
                {user.isActive === false ? 'Unblock user' : 'Block user'}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={onDelete}
                className="rounded-full border border-error px-4 py-2 text-xs text-error hover:bg-error/10 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete account'}
              </button>
            </>
          ) : null}
          {user.creatorStatus === 'pending' ? (
            <>
              <button
                type="button"
                onClick={onApprove}
                className="primary-button rounded-full px-4 py-2 text-xs font-semibold text-on-primary"
              >
                Approve creator
              </button>
              <button
                type="button"
                onClick={onReject}
                className="rounded-full border border-error/40 px-4 py-2 text-xs text-error"
              >
                Reject
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RejectNoteDialog({
  open,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (note: string | undefined) => void;
}) {
  const [note, setNote] = useState('');

  return (
    <Dialog open={open} onClose={onCancel} labelledBy="reject-note-title" size="sm">
      <h2 id="reject-note-title" className="font-display-forge mb-4 text-lg font-semibold">
        Reject creator application
      </h2>
      <label className="block">
        <span className="font-label-caps text-outline">Rejection note (optional)</span>
        <textarea
          className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setNote('');
            onCancel();
          }}
          disabled={loading}
          className="rounded-full border border-outline-variant px-4 py-2 text-sm disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm(note.trim() || undefined);
            setNote('');
          }}
          disabled={loading}
          className="rounded-full border border-error/40 px-4 py-2 text-sm text-error hover:bg-error/10 disabled:opacity-50"
        >
          {loading ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
    </Dialog>
  );
}

function GrantAdminDialog({
  open,
  username,
  loading,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  username: string;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState('');

  return (
    <Dialog open={open} onClose={onCancel} labelledBy="grant-admin-title" size="sm" role="alertdialog">
      <h2 id="grant-admin-title" className="font-display-forge mb-2 text-lg font-semibold">
        Grant admin to @{username}?
      </h2>
      <p className="mb-4 text-sm text-on-surface-variant">
        This grants full platform privileges. Re-enter your password to confirm.
      </p>
      <label className="block">
        <span className="font-label-caps text-outline">Your password</span>
        <input
          type="password"
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setPassword('');
            onCancel();
          }}
          disabled={loading}
          className="rounded-full border border-outline-variant px-4 py-2 text-sm disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm(password);
            setPassword('');
          }}
          disabled={loading || !password}
          className="rounded-full border border-error/40 px-4 py-2 text-sm text-error hover:bg-error/10 disabled:opacity-50"
        >
          {loading ? 'Granting…' : 'Grant admin'}
        </button>
      </div>
    </Dialog>
  );
}

function OverviewTab({
  user,
  summary,
  webBase,
  onNavigateTab,
}: {
  user: AdminUser;
  summary: AdminUserSummary;
  webBase: string;
  onNavigateTab: (tab: string) => void;
}) {
  const stats = summary.videoStats;
  const totalVideos = Object.values(summary.videoStats).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => onNavigateTab('videos')} className="glass-panel rounded-full px-4 py-2 text-xs font-medium hover:border-primary/40">
          {totalVideos} videos →
        </button>
        <button type="button" onClick={() => onNavigateTab('reports')} className="glass-panel rounded-full px-4 py-2 text-xs font-medium hover:border-primary/40">
          {summary.pendingReports} pending reports →
        </button>
        <button type="button" onClick={() => onNavigateTab('activity')} className="glass-panel rounded-full px-4 py-2 text-xs font-medium hover:border-primary/40">
          Watch history →
        </button>
        <button type="button" onClick={() => onNavigateTab('playlists')} className="glass-panel rounded-full px-4 py-2 text-xs font-medium hover:border-primary/40">
          {summary.playlistCount} playlists →
        </button>
        <Link
          href={`/content?userId=${user.id}`}
          className="glass-panel rounded-full px-4 py-2 text-xs font-medium hover:border-primary/40"
        >
          Moderate all videos →
        </Link>
      </div>
    <div className="grid gap-6 md:grid-cols-2">
      <div className="glass-panel rounded-xl p-5">
        <h2 className="font-label-caps mb-4 text-xs text-outline">Account</h2>
        <dl className="space-y-2 text-sm">
          <Row label="User ID" value={user.id} mono />
          <Row label="Joined" value={new Date(user.createdAt).toLocaleString()} />
          <Row label="Last updated" value={new Date(user.updatedAt).toLocaleString()} />
          {user.creatorRequestedAt ? (
            <Row label="Creator requested" value={new Date(user.creatorRequestedAt).toLocaleString()} />
          ) : null}
          {user.creatorReviewedAt ? (
            <Row label="Creator reviewed" value={new Date(user.creatorReviewedAt).toLocaleString()} />
          ) : null}
          {user.creatorReviewNote ? <Row label="Review note" value={user.creatorReviewNote} /> : null}
        </dl>
      </div>
      <div className="glass-panel rounded-xl p-5">
        <h2 className="font-label-caps mb-4 text-xs text-outline">Videos by status</h2>
        <ul className="space-y-2 text-sm">
          {Object.keys(stats).length ? (
            Object.entries(stats).map(([status, count]) => (
              <li key={status} className="flex justify-between">
                <span className="capitalize">{status}</span>
                <span className="font-medium">{count}</span>
              </li>
            ))
          ) : (
            <li className="text-on-surface-variant">No uploads yet</li>
          )}
        </ul>
      </div>
      <div className="glass-panel rounded-xl p-5 md:col-span-2">
        <h2 className="font-label-caps mb-2 text-xs text-outline">Permissions (computed)</h2>
        <p className="text-sm text-on-surface-variant">
          {user.permissions?.length ? user.permissions.join(', ') : 'None'}
        </p>
        <p className="mt-4 text-xs text-outline">
          Profile:{' '}
          <a href={`${webBase}/${user.username}`} className="text-primary hover:underline" target="_blank" rel="noreferrer">
            {webBase}/{user.username}
          </a>
        </p>
      </div>
    </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-outline">{label}</dt>
      <dd className={`text-right ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</dd>
    </div>
  );
}

function VideosTab({
  videos,
  meta,
  isLoading,
  statusFilter,
  onStatusChange,
  page,
  onPageChange,
  webBase,
  isModerating,
  onUpdateVideo,
}: {
  videos?: AdminVideo[];
  meta?: { page: number; totalPages: number; total: number };
  isLoading: boolean;
  statusFilter: string;
  onStatusChange: (s: string) => void;
  page: number;
  onPageChange: (p: number) => void;
  webBase: string;
  isModerating?: boolean;
  onUpdateVideo: (id: string, patch: { status?: string; visibility?: string }) => void;
}) {
  const [pendingVideoAction, setPendingVideoAction] = useState<
    | { kind: 'status'; id: string; title: string; status: string }
    | { kind: 'remove'; id: string; title: string }
    | null
  >(null);

  const columns = useMemo<ColumnDef<AdminVideo, unknown>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ getValue }) => <span className="block max-w-xs truncate font-medium">{getValue<string>()}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const v = row.original;
          return (
            <select
              value={v.status}
              disabled={isModerating}
              onChange={(e) => {
                const status = e.target.value;
                if (status === v.status) return;
                setPendingVideoAction({ kind: 'status', id: v.id, title: v.title, status });
              }}
              className="rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1 text-xs capitalize"
            >
              <option value="ready">ready</option>
              <option value="uploading">uploading</option>
              <option value="processing">processing</option>
              <option value="pending">pending</option>
              <option value="failed">failed</option>
            </select>
          );
        },
      },
      {
        id: 'visibility',
        header: 'Visibility',
        cell: ({ row }) => {
          const v = row.original;
          return (
            <select
              value={v.visibility}
              disabled={isModerating}
              onChange={(e) => {
                const visibility = e.target.value;
                if (visibility === v.visibility) return;
                onUpdateVideo(v.id, { visibility });
              }}
              className="rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1 text-xs"
            >
              <option value="public">public</option>
              <option value="unlisted">unlisted</option>
              <option value="private">private</option>
            </select>
          );
        },
      },
      {
        accessorKey: 'viewCount',
        header: 'Views',
        cell: ({ getValue }) => <span className="text-on-surface-variant">{getValue<number>()}</span>,
      },
      {
        accessorKey: 'createdAt',
        header: 'Uploaded',
        cell: ({ getValue }) => (
          <span className="text-on-surface-variant">{new Date(getValue<string>()).toLocaleDateString()}</span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const v = row.original;
          return (
            <div className="flex flex-col gap-1">
              <a
                href={`${webBase}/watch/${v.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Open
              </a>
              {v.status !== 'failed' ? (
                <button
                  type="button"
                  disabled={isModerating}
                  onClick={() => setPendingVideoAction({ kind: 'remove', id: v.id, title: v.title })}
                  className="text-left text-xs text-error hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [isModerating, onUpdateVideo, webBase],
  );

  return (
    <div className="space-y-4">
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
      >
        <option value="">All statuses</option>
        <option value="ready">Ready</option>
        <option value="uploading">Uploading</option>
        <option value="processing">Processing</option>
        <option value="pending">Pending</option>
        <option value="failed">Failed</option>
      </select>
      <DataTable
        columns={columns}
        data={videos ?? []}
        getRowId={(v) => v.id}
        loading={isLoading}
        emptyState={{ title: 'No videos for this user' }}
      />
      {meta ? (
        <AdminPagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          label="videos"
          onPrev={() => onPageChange(Math.max(1, page - 1))}
          onNext={() => onPageChange(page + 1)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingVideoAction !== null}
        title={
          pendingVideoAction?.kind === 'status'
            ? `Change "${pendingVideoAction.title}" status to ${pendingVideoAction.status}?`
            : pendingVideoAction?.kind === 'remove'
              ? `Remove "${pendingVideoAction.title}" from the platform?`
              : ''
        }
        confirmLabel="Confirm"
        variant="danger"
        loading={isModerating}
        onConfirm={() => {
          if (!pendingVideoAction) return;
          if (pendingVideoAction.kind === 'status') {
            onUpdateVideo(pendingVideoAction.id, { status: pendingVideoAction.status });
          } else {
            onUpdateVideo(pendingVideoAction.id, { status: 'failed' });
          }
          setPendingVideoAction(null);
        }}
        onCancel={() => setPendingVideoAction(null)}
      />
    </div>
  );
}

function ReportsTab({
  userId,
  reports,
  meta,
  isLoading,
  page,
  onPageChange,
  webBase,
}: {
  userId: string;
  reports?: AdminReport[];
  meta?: { page: number; totalPages: number; total: number };
  isLoading: boolean;
  page: number;
  onPageChange: (p: number) => void;
  webBase: string;
}) {
  const columns = useMemo<ColumnDef<AdminReport, unknown>[]>(
    () => [
      {
        accessorKey: 'reason',
        header: 'Reason',
        cell: ({ getValue }) => <span className="block max-w-xs truncate">{getValue<string>()}</span>,
      },
      {
        id: 'target',
        header: 'Target',
        cell: ({ row }) => (
          <span className="text-xs text-on-surface-variant">
            {row.original.targetType} · {row.original.targetId.slice(0, 8)}…
          </span>
        ),
      },
      {
        id: 'reporter',
        header: 'Reporter',
        cell: ({ row }) => {
          const reporter = row.original.reporter;
          if (reporter?.id) {
            return (
              <Link href={`/users/${reporter.id}`} className="text-primary hover:underline">
                @{reporter.username}
              </Link>
            );
          }
          return <span className="text-on-surface-variant">{reporter ? `@${reporter.username}` : '—'}</span>;
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => <span className="capitalize">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'createdAt',
        header: 'Date',
        cell: ({ getValue }) => (
          <span className="text-on-surface-variant">{new Date(getValue<string>()).toLocaleDateString()}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="text-xs">
              <Link href={`/reports/${r.id}`} className="text-primary hover:underline">
                Review
              </Link>
              {r.targetType === 'video' ? (
                <>
                  {' · '}
                  <a
                    href={`${webBase}/watch/${r.targetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Watch
                  </a>
                  {' · '}
                  <Link href={`/content?userId=${userId}`} className="text-primary hover:underline">
                    All videos
                  </Link>
                </>
              ) : r.targetType === 'user' ? (
                <>
                  {' · '}
                  <Link href={`/users/${r.targetId}`} className="text-primary hover:underline">
                    Profile
                  </Link>
                </>
              ) : null}
            </span>
          );
        },
      },
    ],
    [userId, webBase],
  );

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={reports ?? []}
        getRowId={(r) => r.id}
        loading={isLoading}
        emptyState={{ title: 'No reports involving this user' }}
      />
      {meta ? (
        <AdminPagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          label="reports"
          onPrev={() => onPageChange(Math.max(1, page - 1))}
          onNext={() => onPageChange(page + 1)}
        />
      ) : null}
    </div>
  );
}

function ActivityTab({
  videos,
  isLoading,
  webBase,
}: {
  videos?: AdminVideo[];
  isLoading: boolean;
  webBase: string;
}) {
  if (isLoading) return <p className="text-on-surface-variant">Loading watch history…</p>;
  if (!videos?.length) {
    return <p className="glass-panel rounded-xl p-8 text-center text-on-surface-variant">No watch history.</p>;
  }
  return (
    <ul className="space-y-2">
      {videos.map((v) => (
        <li key={v.id} className="glass-panel flex items-center justify-between rounded-lg px-4 py-3">
          <span className="truncate font-medium">{v.title}</span>
          <a
            href={`${webBase}/watch/${v.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-primary hover:underline"
          >
            Open
          </a>
        </li>
      ))}
    </ul>
  );
}

function PlaylistsTab({
  playlists,
  isLoading,
  webBase,
}: {
  playlists?: AdminPlaylist[];
  isLoading: boolean;
  webBase: string;
}) {
  if (isLoading) return <p className="text-on-surface-variant">Loading playlists…</p>;
  if (!playlists?.length) {
    return <p className="glass-panel rounded-xl p-8 text-center text-on-surface-variant">No playlists.</p>;
  }
  return (
    <ul className="space-y-2">
      {playlists.map((p) => (
        <li key={p.id} className="glass-panel flex items-center justify-between rounded-lg px-4 py-3">
          <span className="font-medium">{p.title}</span>
          <a
            href={`${webBase}/playlists/${p.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Open on web
          </a>
        </li>
      ))}
    </ul>
  );
}
