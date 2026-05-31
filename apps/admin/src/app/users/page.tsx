'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { AdminSearchInput } from '@/components/admin/AdminSearchInput';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminPagination } from '@/components/admin/AdminPagination';
import type { AdminUser } from '@/lib/admin-user-types';

const ROLE_CLASS: Record<string, string> = {
  admin: 'bg-error/10 text-error',
  creator: 'bg-primary/10 text-primary',
  user: 'bg-surface-container-high text-on-surface-variant',
};

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [reportedFilter, setReportedFilter] = useState('');
  const qc = useQueryClient();

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
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch(`/admin/users/${id}`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const users = data?.data as AdminUser[] | undefined;

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

      <AdminDataTable
        headers={['User', 'Email', 'Status', 'Role', 'Stats', 'Joined', '']}
        colCount={7}
        isLoading={isLoading}
        isEmpty={!isLoading && !users?.length}
        emptyMessage="No users found."
        footer={
          data?.meta ? (
            <AdminPagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              total={data.meta.total}
              label="users"
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          ) : undefined
        }
      >
        {users?.map((user) => (
          <tr key={user.id} className="hover:bg-surface-container-high/30">
            <td className="px-4 py-3">
              <Link href={`/users/${user.id}`} className="group block">
                <p className="font-medium text-on-surface group-hover:text-primary">{user.displayName}</p>
                <p className="text-xs text-outline">@{user.username}</p>
              </Link>
            </td>
            <td className="px-4 py-3 text-on-surface-variant">{user.email}</td>
            <td className="px-4 py-3 text-xs">
              {user.isActive === false ? (
                <span className="text-error">Blocked</span>
              ) : user.isVerified ? (
                <span className="text-secondary">Verified</span>
              ) : (
                <span className="text-amber-700">Unverified</span>
              )}
            </td>
            <td className="px-4 py-3">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_CLASS[user.role] ?? ROLE_CLASS.user}`}>
                {user.role}
              </span>
              {user.creatorStatus ? (
                <span className="ml-1 text-[10px] text-outline">({user.creatorStatus})</span>
              ) : null}
            </td>
            <td className="px-4 py-3 text-xs text-on-surface-variant">
              {user.followerCount} followers · {user.videoCount} videos
            </td>
            <td className="px-4 py-3 text-on-surface-variant">
              {new Date(user.createdAt).toLocaleDateString()}
            </td>
            <td className="px-4 py-3">
              <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                <Link
                  href={`/users/${user.id}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View profile
                </Link>
                <select
                  value={user.role}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const role = e.target.value;
                    if (role === 'admin' && !window.confirm(`Grant admin role to @${user.username}?`)) {
                      e.target.value = user.role;
                      return;
                    }
                    if (role !== user.role && !window.confirm(`Change @${user.username} role to ${role}?`)) {
                      e.target.value = user.role;
                      return;
                    }
                    updateRole.mutate({ id: user.id, role });
                  }}
                  className="rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1 text-xs"
                >
                  <option value="user">user</option>
                  <option value="creator">creator</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </section>
  );
}
