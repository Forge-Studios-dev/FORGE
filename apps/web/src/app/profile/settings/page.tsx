'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader, Button, Input } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { user: stored, refresh, isGuest } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isGuest) {
      router.replace('/login?next=/profile/settings');
      return;
    }
    if (stored) {
      setDisplayName(stored.displayName ?? '');
      setBio(stored.bio ?? '');
    }
  }, [stored, isGuest, router]);

  const handleSave = async () => {
    if (!stored) return;
    setSaving(true);
    setMessage('');
    try {
      const { data } = await api.put(`/users/${stored.id}`, {
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
      });
      const updated = data.data;
      localStorage.setItem('forge_user', JSON.stringify(updated));
      refresh();
      setMessage('Settings saved.');
    } catch {
      setMessage('Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (isGuest || !stored) return null;

  return (
    <main className="mx-auto max-w-xl px-5 py-8 md:px-12">
      <Link href={`/${stored.username}`} className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Profile
      </Link>
      <PageHeader title="Settings" subtitle="Manage your account preferences" />
      <form
        className="glass-panel space-y-4 rounded-2xl p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        {message ? <p className="text-sm text-secondary">{message}</p> : null}
        <label className="block">
          <span className="font-label-caps text-outline">Display name</span>
          <Input className="mt-2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="block">
          <span className="font-label-caps text-outline">Bio</span>
          <textarea
            className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 outline-none focus:border-primary"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </main>
  );
}
