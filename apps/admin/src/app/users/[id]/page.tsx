'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
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

const ROLE_CLASS: Record<string, string> = {
  admin: 'bg-error/10 text-error',
  creator: 'bg-primary/10 text-primary',
  user: 'bg-surface-container-high text-on-surface-variant',
};

const STATUS_CLASS: Record<string, string> = {
  ready: 'bg-secondary/10 text-secondary',
  processing: 'bg-tertiary/10 text-tertiary',
  pending: 'bg-surface-container-high text-outline',
  failed: 'bg-error/10 text-error',
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = params.id as string;
  const tab = (searchParams.get('tab') as TabId) || 'overview';
  const qc = useQueryClient();
  const webBase = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';

  const [videoPage, setVideoPage] = useState(1);
  const [videoStatus, setVideoStatus] = useState('');
  const [reportPage, setReportPage] = useState(1);

  const { data: summary, isLoading, isError } = useQuery({
    queryKey: ['admin-user-summary', userId],
    queryFn: async () => {
      const { data } = await api.get<{ data: AdminUserSummary }>(`/admin/users/${userId}/summary`);
      return data.data;
    },
  });

  const user = summary?.user;

  const updateUser = useMutation({
    mutationFn: (body: { role?: string; isVerified?: boolean }) =>
      api.patch(`/admin/users/${userId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-user-summary', userId] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
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
      if (
        !window.confirm(
          `Open web as ${result.targetUser.displayName}? Link expires in ${result.expiresInSeconds}s.`,
        )
      ) {
        return;
      }
      window.open(result.url, '_blank', 'noopener,noreferrer');
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
          if (role === 'admin' && !window.confirm(`Grant admin to @${user.username}?`)) return;
          if (!window.confirm(`Change @${user.username} role to ${role}?`)) return;
          updateUser.mutate({ role });
        }}
        onVerifyToggle={() => updateUser.mutate({ isVerified: !user.isVerified })}
        onApprove={() => approveCreator.mutate()}
        onReject={() => {
          const note = window.prompt('Rejection note (optional):') ?? undefined;
          rejectCreator.mutate(note);
        }}
        onImpersonate={() => impersonate.mutate()}
        isImpersonating={impersonate.isPending}
      />

      <AdminTabs tabs={[...TABS]} active={tab} onChange={setTab} />

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
  onApprove,
  onReject,
  onImpersonate,
  isImpersonating,
}: {
  user: AdminUser;
  summary: AdminUserSummary;
  webBase: string;
  onRoleChange: (role: string) => void;
  onVerifyToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  onImpersonate: () => void;
  isImpersonating?: boolean;
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
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_CLASS[user.role] ?? ROLE_CLASS.user}`}>
              {user.role}
            </span>
            {user.creatorStatus ? (
              <span className="rounded-full bg-tertiary/10 px-2 py-0.5 text-xs text-tertiary">
                creator: {user.creatorStatus}
              </span>
            ) : null}
            {user.isVerified ? (
              <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-xs text-secondary">verified</span>
            ) : (
              <span className="rounded-full bg-outline/10 px-2 py-0.5 text-xs text-outline">unverified</span>
            )}
          </div>
          <p className="mt-1 text-on-surface-variant">@{user.username} · {user.email}</p>
          {user.bio ? <p className="mt-3 text-sm text-on-surface-variant">{user.bio}</p> : null}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-on-surface-variant">
            <span>{user.followerCount} followers</span>
            <span>{user.followingCount} following</span>
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
      <AdminDataTable
        headers={['Title', 'Status', 'Visibility', 'Views', 'Uploaded', 'Actions']}
        colCount={6}
        isLoading={isLoading}
        isEmpty={!isLoading && !videos?.length}
        emptyMessage="No videos for this user."
        footer={
          meta ? (
            <AdminPagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              label="videos"
              onPrev={() => onPageChange(Math.max(1, page - 1))}
              onNext={() => onPageChange(page + 1)}
            />
          ) : undefined
        }
      >
        {videos?.map((v) => (
          <tr key={v.id} className="hover:bg-surface-container-high/30">
            <td className="max-w-xs truncate px-4 py-3 font-medium">{v.title}</td>
            <td className="px-4 py-3">
              <select
                value={v.status}
                disabled={isModerating}
                onChange={(e) => {
                  const status = e.target.value;
                  if (status === v.status) return;
                  if (!window.confirm(`Change "${v.title}" status to ${status}?`)) {
                    e.target.value = v.status;
                    return;
                  }
                  onUpdateVideo(v.id, { status });
                }}
                className="rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1 text-xs capitalize"
              >
                <option value="ready">ready</option>
                <option value="uploading">uploading</option>
                <option value="processing">processing</option>
                <option value="pending">pending</option>
                <option value="failed">failed</option>
              </select>
            </td>
            <td className="px-4 py-3">
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
            </td>
            <td className="px-4 py-3 text-on-surface-variant">{v.viewCount}</td>
            <td className="px-4 py-3 text-on-surface-variant">
              {new Date(v.createdAt).toLocaleDateString()}
            </td>
            <td className="px-4 py-3">
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
                    onClick={() => {
                      if (!window.confirm(`Remove "${v.title}" from the platform?`)) return;
                      onUpdateVideo(v.id, { status: 'failed' });
                    }}
                    className="text-left text-xs text-error hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </AdminDataTable>
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
  return (
    <AdminDataTable
      headers={['Reason', 'Target', 'Reporter', 'Status', 'Date', '']}
      colCount={6}
      isLoading={isLoading}
      isEmpty={!isLoading && !reports?.length}
      emptyMessage="No reports involving this user."
      footer={
        meta ? (
          <AdminPagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            label="reports"
            onPrev={() => onPageChange(Math.max(1, page - 1))}
            onNext={() => onPageChange(page + 1)}
          />
        ) : undefined
      }
    >
      {reports?.map((r) => (
        <tr key={r.id} className="hover:bg-surface-container-high/30">
          <td className="max-w-xs truncate px-4 py-3">{r.reason}</td>
          <td className="px-4 py-3 text-xs text-on-surface-variant">
            {r.targetType} · {r.targetId.slice(0, 8)}…
          </td>
          <td className="px-4 py-3 text-on-surface-variant">
            {r.reporter?.id ? (
              <Link href={`/users/${r.reporter.id}`} className="text-primary hover:underline">
                @{r.reporter.username}
              </Link>
            ) : r.reporter ? (
              `@${r.reporter.username}`
            ) : (
              '—'
            )}
          </td>
          <td className="px-4 py-3 capitalize">{r.status}</td>
          <td className="px-4 py-3 text-on-surface-variant">
            {new Date(r.createdAt).toLocaleDateString()}
          </td>
          <td className="px-4 py-3">
            <Link href={`/reports/${r.id}`} className="text-xs text-primary hover:underline">
              Review
            </Link>
            {r.targetType === 'video' ? (
              <>
                {' · '}
                <a
                  href={`${webBase}/watch/${r.targetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  Watch
                </a>
                {' · '}
                <Link href={`/content?userId=${userId}`} className="text-xs text-primary hover:underline">
                  All videos
                </Link>
              </>
            ) : r.targetType === 'user' ? (
              <>
                {' · '}
                <Link href={`/users/${r.targetId}`} className="text-xs text-primary hover:underline">
                  Profile
                </Link>
              </>
            ) : null}
          </td>
        </tr>
      ))}
    </AdminDataTable>
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

