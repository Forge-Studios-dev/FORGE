'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader, StatusPill, type StatusTone } from '@forge/design-system';
import { DataTable, useToast } from '@forge/design-system/client';
import { api } from '@/lib/api';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { AdminPagination } from '@/components/admin/AdminPagination';
import type { AdminUser } from '@/lib/admin-user-types';

const ROLE_TONE: Record<string, StatusTone> = {
  admin: 'critical',
  creator: 'primary',
  user: 'neutral',
};

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [reportedFilter, setReportedFilter] = useState('');
  const [selected, setSelected] = useState<AdminUser[]>([]);
  const qc = useQueryClient();
  const { toast } = useToast();

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
    mutationFn: ({ id, role }: { id: string; role: string }) => api.patch(`/admin/users/${id}`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const bulkUpdate = useMutation({
    mutationFn: (payload: { ids: string[]; role?: string; isActive?: boolean }) =>
      api.patch('/admin/users/bulk', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  /** Reverts each row to its own captured prior value — a bulk change isn't one value, so undo can't be either. */
  async function undoBulk(snapshot: Array<{ id: string; role: string; isActive?: boolean }>) {
    await Promise.all(
      snapshot.map((row) => api.patch(`/admin/users/${row.id}`, { role: row.role, isActive: row.isActive })),
    );
    qc.invalidateQueries({ queryKey: ['admin-users'] });
  }

  function runBulk(action: { role?: string; isActive?: boolean; label: string }) {
    const snapshot = selected.map((u) => ({ id: u.id, role: u.role, isActive: u.isActive }));
    const ids = snapshot.map((s) => s.id);
    bulkUpdate.mutate(
      { ids, role: action.role, isActive: action.isActive },
      {
        onSuccess: () => {
          toast({
            title: `${action.label} — ${ids.length} user${ids.length === 1 ? '' : 's'}`,
            variant: 'success',
            action: { label: 'Undo', onClick: () => undoBulk(snapshot) },
          });
          setSelected([]);
        },
        onError: () => toast({ title: 'Bulk update failed', variant: 'critical' }),
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
            {row.original.followerCount} followers · {row.original.videoCount} videos
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
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const role = e.target.value;
                if (role === u.role) return;
                const prevRole = u.role;
                updateRole.mutate(
                  { id: u.id, role },
                  {
                    onSuccess: () =>
                      toast({
                        title: `@${u.username} role changed to ${role}`,
                        variant: 'success',
                        action: { label: 'Undo', onClick: () => updateRole.mutate({ id: u.id, role: prevRole }) },
                      }),
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
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search name, email, or username…"
            className="sm:min-w-[240px] sm:flex-1"
          />
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          >
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="creator">Creator</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={creatorFilter}
            onChange={(e) => {
              setCreatorFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          >
            <option value="">Creator status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          >
            <option value="">Account status</option>
            <option value="true">Active</option>
            <option value="false">Blocked</option>
          </select>
          <select
            value={verifiedFilter}
            onChange={(e) => {
              setVerifiedFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
          >
            <option value="">Email verification</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
          <select
            value={reportedFilter}
            onChange={(e) => {
              setReportedFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm"
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
              onClick={() => runBulk({ isActive: false, label: 'Blocked' })}
              className="rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold hover:border-critical hover:text-critical"
            >
              Block
            </button>
            <button
              type="button"
              onClick={() => runBulk({ isActive: true, label: 'Unblocked' })}
              className="rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold hover:border-success hover:text-success"
            >
              Unblock
            </button>
            <select
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                runBulk({ role: e.target.value, label: `Role set to ${e.target.value}` });
                e.target.value = '';
              }}
              className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 text-xs font-semibold"
            >
              <option value="">Set role…</option>
              <option value="user">user</option>
              <option value="creator">creator</option>
              <option value="admin">admin</option>
            </select>
          </>
        )}
      />
      {data?.meta ? (
        <AdminPagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          label="users"
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      ) : null}
    </section>
  );
}
