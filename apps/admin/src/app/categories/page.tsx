'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Icon, Input, PageHeader } from '@forge/design-system';
import { ConfirmDialog, useToast } from '@forge/design-system/client';
import { api } from '@/lib/api';

interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  description?: string | null;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', sortOrder: '0', description: '' });
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const {
    data,
    isLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        sortOrder: Number(form.sortOrder) || 0,
        description: form.description.trim() || undefined,
      };
      if (editing) {
        await api.patch(`/admin/categories/${editing.id}`, payload);
      } else {
        await api.post('/admin/categories', payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', slug: '', sortOrder: '0', description: '' });
      setError('');
      toast({ title: editing ? 'Category updated' : 'Category created', variant: 'success' });
    },
    onError: () => setError('Could not save category. Check name/slug uniqueness.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      setPendingDelete(null);
      toast({ title: 'Category deleted', variant: 'success' });
    },
    onError: () => {
      setError('Cannot delete — remove subcategories first.');
      setPendingDelete(null);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', slug: '', sortOrder: String((data?.length ?? 0) + 1), description: '' });
    setShowForm(true);
    setError('');
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      sortOrder: String(cat.sortOrder),
      description: cat.description ?? '',
    });
    setShowForm(true);
    setError('');
  };

  return (
    <section>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Categories" subtitle="Manage categories for discovery" />
        <Button type="button" onClick={openCreate}>
          Add category
        </Button>
      </div>

      {error ? <p className="mb-4 text-sm text-error">{error}</p> : null}

      {showForm && (
        <form
          className="glass-panel mb-8 space-y-4 rounded-xl p-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <h3 className="font-display-forge font-semibold">{editing ? 'Edit category' : 'New category'}</h3>
          <label className="block">
            <span className="font-label-caps text-outline">Name</span>
            <Input
              className="mt-1"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  name: e.target.value,
                  slug: f.slug || slugify(e.target.value),
                }))
              }
              required
            />
          </label>
          <label className="block">
            <span className="font-label-caps text-outline">Slug</span>
            <Input className="mt-1" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} required />
          </label>
          <label className="block">
            <span className="font-label-caps text-outline">Sort order</span>
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="font-label-caps text-outline">Description</span>
            <Input className="mt-1" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              className="rounded-full border border-outline-variant px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-panel h-28 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : categoriesError ? (
        <div className="glass-panel flex flex-col items-center rounded-xl px-6 py-12 text-center">
          <p className="text-error">Failed to load categories.</p>
          <button
            type="button"
            onClick={() => refetchCategories()}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      ) : !data?.length ? (
        <div className="glass-panel flex flex-col items-center rounded-xl px-6 py-12 text-center">
          <Icon name="category" className="mb-4 text-4xl text-outline" />
          <p className="font-display-forge text-lg font-semibold">No categories</p>
          <p className="mt-2 text-sm text-on-surface-variant">Add your first category to organize discovery.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((cat) => (
            <article key={cat.id} className="glass-panel rounded-xl p-5">
              <header className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-semibold">{cat.name}</h3>
                <span className="font-label-caps shrink-0 rounded bg-surface-container-high px-2 py-0.5 text-xs text-outline">
                  #{cat.sortOrder}
                </span>
              </header>
              <p className="mb-4 text-xs text-outline">{cat.slug}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => openEdit(cat)} className="text-xs text-primary hover:underline">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(cat)}
                  className="text-xs text-error hover:underline"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name}"?`}
        confirmLabel="Delete"
        variant="danger"
        loading={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
