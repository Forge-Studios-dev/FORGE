'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState, Icon, ListSkeleton, PageHeader, StatusPill } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api-message';

type CreatorResource = {
  id: string;
  title: string;
  description?: string | null;
  fileName: string;
  mimeType: string;
  fileSizeBytes?: number | null;
  visibility: 'public' | 'subscribers' | 'tier';
  downloadCount: number;
  isActive: boolean;
  updatedAt: string;
};

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StudioResourcesPage() {
  const { isCreator } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'subscribers' | 'tier'>('subscribers');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['studio-resources'],
    enabled: isCreator,
    queryFn: async () => {
      const { data } = await api.get<{ data: { data: CreatorResource[] } }>('/creators/me/resources');
      return data.data?.data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/creators/me/resources/${id}`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['studio-resources'] }),
  });

  const uploadResource = async () => {
    if (!file || !title.trim()) return;
    setError('');
    setUploading(true);
    try {
      const { data: presign } = await api.post<{
        data: { uploadUrl: string; key: string; fileUrl: string };
      }>('/creators/me/resources/upload-url', {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSizeBytes: file.size,
      });
      const payload = presign.data;
      const put = await fetch(payload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) throw new Error('File upload to storage failed');

      await api.post('/creators/me/resources', {
        title: title.trim(),
        description: description.trim() || undefined,
        fileKey: payload.key,
        fileUrl: payload.fileUrl,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSizeBytes: file.size,
        visibility,
      });

      setTitle('');
      setDescription('');
      setFile(null);
      void qc.invalidateQueries({ queryKey: ['studio-resources'] });
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not upload resource.'));
    } finally {
      setUploading(false);
    }
  };

  if (!isCreator) {
    return (
      <main className="space-y-4">
        <PageHeader title="Resources" subtitle="Creator access required." />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Resources library"
        subtitle="Upload downloadable assets, then assign them to tiers, bundles, courses, or lessons."
      />

      <section className="glass-panel space-y-4 rounded-2xl p-6">
        <div>
          <p className="font-label-caps text-xs text-outline">Upload</p>
          <h2 className="mt-1 text-lg font-semibold">Add a resource</h2>
        </div>
        {error ? <p className="text-sm text-error">{error}</p> : null}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Resource title"
          className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          rows={2}
          className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-on-surface-variant">Visibility</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as typeof visibility)}
              className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5"
            >
              <option value="public">Public</option>
              <option value="subscribers">Members</option>
              <option value="tier">Tier-specific</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-on-surface-variant">File</span>
            <input
              type="file"
              className="mt-1 w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={!title.trim() || !file || uploading}
          onClick={() => void uploadResource()}
          className="primary-button inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50"
        >
          <Icon name="upload" />
          {uploading ? 'Uploading…' : 'Upload resource'}
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Your library</h2>
        {isLoading ? <ListSkeleton rows={4} /> : null}
        {isError ? <p className="text-sm text-error">Failed to load resources.</p> : null}
        {!isLoading && !isError && !(data?.length ?? 0) ? (
          <EmptyState
            icon="inventory_2"
            title="No resources yet"
            description="Upload PDFs, templates, spreadsheets, or audio assets for members and course buyers."
          />
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-outline-variant/30">
          {(data?.length ?? 0) > 0 ? (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-outline-variant/30 bg-surface-container-low text-xs uppercase tracking-wide text-outline">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Visibility</th>
                  <th className="px-4 py-3 font-medium">Downloads</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((resource) => (
                  <tr key={resource.id} className="border-b border-outline-variant/20 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{resource.title}</p>
                      <p className="text-xs text-on-surface-variant">{resource.fileName}</p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{resource.mimeType}</td>
                    <td className="px-4 py-3">
                      <StatusPill
                        tone={resource.isActive ? 'primary' : 'neutral'}
                        label={resource.visibility}
                      />
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{resource.downloadCount}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{formatBytes(resource.fileSizeBytes)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete “${resource.title}”?`)) {
                            deleteMutation.mutate(resource.id);
                          }
                        }}
                        className="text-sm text-error hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </section>
    </main>
  );
}
