'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isAxiosError } from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader, StatusPill, type StatusTone } from '@forge/design-system';
import { ConfirmDialog, DataTable, useToast } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { GrantAdminDialog } from '@/components/admin/GrantAdminDialog';
import type { AdminUser } from '@/lib/admin-user-types';

const ROLE_TONE: Record<string, StatusTone> = {
  admin: 'critical',
  creator: 'primary',
  user: 'neutral',
};

const ROLES = ['user', 'creator', 'admin'] as const;
const CREATOR_STATUSES = ['pending', 'approved', 'rejected'] as const;
const BOOLS = ['true', 'false'] as const;

function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parseOneOf(raw: string | null, allowed: readonly string[]): string {
  if (!raw) return '';
  return allowed.includes(raw) ? raw : '';
}

export default function UsersPage() {
  return (
    <Suspense fallback={<p className="text-on-surface-variant">Loading users…</p>}>
      <UsersPageInner />
    </Suspense>
  );
}

function UsersPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchParam = searchParams.get('search') ?? '';
  const roleParam = searchParams.get('role');
  const creatorParam = searchParams.get('creatorStatus');
  const activeParam = searchParams.get('isActive');
  const verifiedParam = searchParams.get('emailVerified');
  const reportedParam = searchParams.get('hasPendingReports');
  const pageParam = searchParams.get('page');

  const [page, setPage] = useState(() => parsePage(pageParam));
  const [searchDraft, setSearchDraft] = useState(searchParam);
  const [search, setSearch] = useState(searchParam);
  const [roleFilter, setRoleFilter] = useState(() => parseOneOf(roleParam, ROLES));
  const [creatorFilter, setCreatorFilter] = useState(() =>
    parseOneOf(creatorParam, CREATOR_STATUSES),
  );
  const [activeFilter, setActiveFilter] = useState(() => parseOneOf(activeParam, BOOLS));
  const [verifiedFilter, setVerifiedFilter] = useState(() => parseOneOf(verifiedParam, BOOLS));
  const [reportedFilter, setReportedFilter] = useState(
    () => (reportedParam === 'true' || reportedParam === 'yes' ? 'yes' : ''),
  );
  const [selected, setSelected] = useState<AdminUser[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<
    { role?: string; isActive?: boolean; label: string } | null
  >(null);
  const [grantAdminOpen, setGrantAdminOpen] = useState(false);
  const [grantAdminError, setGrantAdminError] = useState<string | null>(null);
  const [pendingGrant, setPendingGrant] = useState<
    | { kind: 'bulk'; ids: string[]; snapshot: Array<{ id: string; role: string; isActive?: boolean }> }
    | { kind: 'row'; id: string; username: string; prevRole: string }
    | null
  >(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    setSearchDraft(searchParam);
    setSearch(searchParam);
    setRoleFilter(parseOneOf(roleParam, ROLES));
    setCreatorFilter(parseOneOf(creatorParam, CREATOR_STATUSES));
    setActiveFilter(parseOneOf(activeParam, BOOLS));
    setVerifiedFilter(parseOneOf(verifiedParam, BOOLS));
    setReportedFilter(reportedParam === 'true' || reportedParam === 'yes' ? 'yes' : '');
    setPage(parsePage(pageParam));
  }, [
    searchParam,
    roleParam,
    creatorParam,
    activeParam,
    verifiedParam,
    reportedParam,
    pageParam,
  ]);

  function syncUrl(next: {
    search?: string;
    role?: string;
    creatorStatus?: string;
    isActive?: string;
    emailVerified?: string;
    reported?: string;
    page?: number;
  }) {
    const params = new URLSearchParams();
    const q = (next.search ?? search).trim();
    const role = next.role ?? roleFilter;
    const creatorStatus = next.creatorStatus ?? creatorFilter;
    const isActive = next.isActive ?? activeFilter;
    const emailVerified = next.emailVerified ?? verifiedFilter;
    const reported = next.reported ?? reportedFilter;
    const nextPage = next.page ?? page;

    if (q) params.set('search', q);
    if (role) params.set('role', role);
    if (creatorStatus) params.set('creatorStatus', creatorStatus);
    if (isActive) params.set('isActive', isActive);
    if (emailVerified) params.set('emailVerified', emailVerified);
    if (reported === 'yes') params.set('hasPendingReports', 'true');
    if (nextPage > 1) params.set('page', String(nextPage));

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = searchDraft.trim();
      if (next === search) return;
      setSearch(next);
      setPage(1);
      syncUrl({ search: next, page: 1 });
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce draft only
  }, [searchDraft]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users', page, search, roleFilter, creatorFilter, activeFilter, verifiedFilter, reportedFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (creatorFilter) params.set('creatorStatus', creatorFilter);
      if (activeFilter) params.set('isActive', activeFilter);
      if (verifiedFilter) params.set('emailVerified', verifiedFilter);
      if (reportedFilter === 'yes') params.set('hasPendingReports', 'true');
      const { data } = await api.get(`/admin/users?${params}`);
      return data.data;
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role, currentAdminPassword }: { id: string; role: string; currentAdminPassword?: string }) =>
      api.patch(`/admin/users/${id}`, { role, currentAdminPassword }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const bulkUpdate = useMutation({
    mutationFn: (payload: {
      ids: string[];
      role?: string;
      isActive?: boolean;
      currentAdminPassword?: string;
    }) => api.patch('/admin/users/bulk', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  /** Reverts each row to its own captured prior value — a bulk change isn't one value, so undo can't be either. */
  async function undoBulk(snapshot: Array<{ id: string; role: string; isActive?: boolean }>) {
    await Promise.all(
      snapshot.map((row) => api.patch(`/admin/users/${row.id}`, { role: row.role, isActive: row.isActive })),
    );
    qc.invalidateQueries({ queryKey: ['admin-users'] });
  }

  function runBulk(action: { role?: string; isActive?: boolean; label: string }, currentAdminPassword?: string) {
    const snapshot = selected.map((u) => ({ id: u.id, role: u.role, isActive: u.isActive }));
    const ids = snapshot.map((s) => s.id);
    bulkUpdate.mutate(
      { ids, role: action.role, isActive: action.isActive, currentAdminPassword },
      {
        onSuccess: () => {
          toast({
            title: `${action.label} — ${ids.length} user${ids.length === 1 ? '' : 's'}`,
            variant: 'success',
            action: { label: 'Undo', onClick: () => undoBulk(snapshot) },
          });
          setSelected([]);
          setGrantAdminOpen(false);
          setPendingGrant(null);
        },
        onError: (err) => {
          // A bulk admin-role grant needs the step-up password (MED-13) —
          // surface that in the dialog instead of a dead-end generic toast.
          if (action.role === 'admin') {
            const message =
              isAxiosError<{ message?: string | string[] }>(err) && err.response?.data?.message
                ? err.response.data.message
                : 'Could not grant admin role.';
            setGrantAdminError(Array.isArray(message) ? message[0] : message);
            return;
          }
          toast({ title: 'Bulk update failed', variant: 'critical' });
        },
      },
    );
  }

  const users = data?.data as AdminUser[] | undefined;

  const columns = useMemo<ColumnDef<AdminUser, unknown>[]>(
    () => [
      {
        id: 'user',
        header: 'User',
        cell: ({ row }) => (
          <Link href={`/users/${row.original.id}`} className="group block">
            <p className="font-medium text-on-surface group-hover:text-primary">{row.original.displayName}</p>
            <p className="text-xs text-outline">@{row.original.username}</p>
          </Link>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => <span className="text-on-surface-variant">{getValue<string>()}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const u = row.original;
          if (u.isActive === false) return <span className="text-xs text-error">Blocked</span>;
          if (u.isVerified) return <span className="text-xs text-secondary">Verified</span>;
          return <span className="text-xs text-warning">Unverified</span>;
        },
      },
      {
        id: 'role',
        header: 'Role',
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex items-center gap-1">
              <StatusPill tone={ROLE_TONE[u.role] ?? ROLE_TONE.user} label={u.role} />
              {u.creatorStatus ? <span className="text-[10px] text-outline">({u.creatorStatus})</span> : null}
            </div>
          );
        },
      },
      {
        id: 'stats',
        header: 'Stats',
        cell: ({ row }) => (
          <span className="text-xs text-on-surface-variant">
            {row.original.followerCount} subscribers · {row.original.videoCount} videos
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Joined',
        cell: ({ getValue }) => (
          <span className="text-on-surface-variant">{new Date(getValue<string>()).toLocaleDateString()}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const u = row.original;
          return (
            <select
              value={u.role}
              aria-label={`Change role for @${u.username}`}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const role = e.target.value;
                if (role === u.role) return;
                const prevRole = u.role;
                if (role === 'admin') {
                  setGrantAdminError(null);
                  setPendingGrant({ kind: 'row', id: u.id, username: u.username, prevRole });
                  setGrantAdminOpen(true);
                  e.target.value = u.role;
                  return;
                }
                updateRole.mutate(
                  { id: u.id, role },
                  {
                    onSuccess: () =>
                      toast({
                        title: `@${u.username} role changed to ${role}`,
                        variant: 'success',
                        action: { label: 'Undo', onClick: () => updateRole.mutate({ id: u.id, role: prevRole }) },
                      }),
                    onError: () =>
                      toast({ title: `Could not change @${u.username}'s role`, variant: 'critical' }),
                  },
                );
              }}
              className="rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1 text-xs"
            >
              <option value="user">user</option>
              <option value="creator">creator</option>
              <option value="admin">admin</option>
            </select>
          );
        },
      },
    ],
    [updateRole, toast],
  );

  if (isError) {
    return (
      <section>
        <PageHeader title="Users" subtitle="Search accounts and open a profile to review uploads, reports, and activity" />
        <p className="text-error">Failed to load users.</p>
        <button type="button" onClick={() => refetch()} className="mt-4 text-sm text-primary hover:underline">
          Retry
        </button>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-8 flex flex-col gap-4">
        <PageHeader title="Users" subtitle="Search accounts and open a profile to review uploads, reports, and activity" />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <AdminSearchInput
            value={searchDraft}
            onChange={(v) => setSearchDraft(v)}
            placeholder="Search name, email, or username…"
            className="sm:min-w-[240px] sm:flex-1"
          />
          <select
            value={roleFilter}
            onChange={(e) => {
              const next = e.target.value;
              setRoleFilter(next);
              setPage(1);
              syncUrl({ role: next, page: 1 });
            }}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            aria-label="Filter by role"
          >
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="creator">Creator</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={creatorFilter}
            onChange={(e) => {
              const next = e.target.value;
              setCreatorFilter(next);
              setPage(1);
              syncUrl({ creatorStatus: next, page: 1 });
            }}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            aria-label="Filter by creator status"
          >
            <option value="">Creator status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={activeFilter}
            onChange={(e) => {
              const next = e.target.value;
              setActiveFilter(next);
              setPage(1);
              syncUrl({ isActive: next, page: 1 });
            }}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            aria-label="Filter by account status"
          >
            <option value="">Account status</option>
            <option value="true">Active</option>
            <option value="false">Blocked</option>
          </select>
          <select
            value={verifiedFilter}
            onChange={(e) => {
              const next = e.target.value;
              setVerifiedFilter(next);
              setPage(1);
              syncUrl({ emailVerified: next, page: 1 });
            }}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            aria-label="Filter by email verification"
          >
            <option value="">Email verification</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
          <select
            value={reportedFilter}
            onChange={(e) => {
              const next = e.target.value;
              setReportedFilter(next);
              setPage(1);
              syncUrl({ reported: next, page: 1 });
            }}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
            aria-label="Filter by pending reports"
          >
            <option value="">Reports</option>
            <option value="yes">Pending reports</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={users ?? []}
        getRowId={(u) => u.id}
        loading={isLoading}
        selectable
        onSelectionChange={setSelected}
        emptyState={{ title: 'No users found', description: 'Try adjusting your search or filters.' }}
        bulkActions={() => (
          <>
            <button
              type="button"
              onClick={() => setPendingConfirm({ isActive: false, label: 'Blocked' })}
              className="rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold hover:border-critical hover:text-critical"
            >
              Block
            </button>
            <button
              type="button"
              onClick={() => setPendingConfirm({ isActive: true, label: 'Unblocked' })}
              className="rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold hover:border-success hover:text-success"
            >
              Unblock
            </button>
            <select
              defaultValue=""
              onChange={(e) => {
                const role = e.target.value;
                if (!role) return;
                if (role === 'admin') {
                  setGrantAdminError(null);
                  const snapshot = selected.map((u) => ({ id: u.id, role: u.role, isActive: u.isActive }));
                  setPendingGrant({ kind: 'bulk', ids: snapshot.map((s) => s.id), snapshot });
                  setGrantAdminOpen(true);
                } else {
                  setPendingConfirm({ role, label: `Role set to ${role}` });
                }
                e.target.value = '';
              }}
              className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 text-xs font-semibold"
              aria-label="Bulk set role"
            >
              <option value="">Set role…</option>
              <option value="user">user</option>
              <option value="creator">creator</option>
              <option value="admin">admin</option>
            </select>
          </>
        )}
      />

      <ConfirmDialog
        open={pendingConfirm !== null}
        title={
          pendingConfirm?.role
            ? `Set role to ${pendingConfirm.role} for ${selected.length} user${selected.length === 1 ? '' : 's'}?`
            : pendingConfirm?.isActive === false
              ? `Block ${selected.length} user${selected.length === 1 ? '' : 's'}? They will be signed out and cannot log in.`
              : `Unblock ${selected.length} user${selected.length === 1 ? '' : 's'}?`
        }
        confirmLabel="Confirm"
        variant="danger"
        loading={bulkUpdate.isPending}
        onConfirm={() => {
          if (!pendingConfirm) return;
          runBulk(pendingConfirm);
          setPendingConfirm(null);
        }}
        onCancel={() => setPendingConfirm(null)}
      />

      <GrantAdminDialog
        open={grantAdminOpen}
        title={
          pendingGrant?.kind === 'bulk'
            ? `Grant admin to ${pendingGrant.ids.length} user${pendingGrant.ids.length === 1 ? '' : 's'}?`
            : pendingGrant?.kind === 'row'
              ? `Grant admin to @${pendingGrant.username}?`
              : 'Grant admin?'
        }
        loading={bulkUpdate.isPending || updateRole.isPending}
        error={grantAdminError}
        onCancel={() => {
          setGrantAdminOpen(false);
          setGrantAdminError(null);
          setPendingGrant(null);
        }}
        onConfirm={(password) => {
          setGrantAdminError(null);
          if (pendingGrant?.kind === 'bulk') {
            runBulk({ role: 'admin', label: 'Role set to admin' }, password);
          } else if (pendingGrant?.kind === 'row') {
            updateRole.mutate(
              { id: pendingGrant.id, role: 'admin', currentAdminPassword: password },
              {
                onSuccess: () => {
                  setGrantAdminOpen(false);
                  setPendingGrant(null);
                  toast({ title: `@${pendingGrant.username} role changed to admin`, variant: 'success' });
                },
                onError: (err) => {
                  const message =
                    isAxiosError<{ message?: string | string[] }>(err) && err.response?.data?.message
                      ? err.response.data.message
                      : 'Could not grant admin role.';
                  setGrantAdminError(Array.isArray(message) ? message[0] : message);
                },
              },
            );
          }
        }}
      />
      {data?.meta ? (
        <AdminPagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          label="users"
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
    </section>
  );
}
