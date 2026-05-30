'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getAccessToken, persistAuthSession } from '@/lib/auth-storage';
import { User } from '@/types';

export default function BecomeCreatorPage() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<{ data: User }>('/users/me/request-creator', { bio });
      const access = getAccessToken();
      if (access) {
        persistAuthSession(access, undefined, JSON.stringify(data.data));
      } else if (user) {
        localStorage.setItem('forge_user', JSON.stringify(data.data));
      }
      refresh();
      router.push('/waiting-approval');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'Could not submit application.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-5 py-16 md:px-12">
      <PageHeader
        title="Become a creator"
        subtitle="Share your expertise through tutorials and live teaching"
      />
      <form onSubmit={handleSubmit} className="glass-panel space-y-5 rounded-2xl p-8">
        {error && <p className="text-sm text-error">{error}</p>}
        <div>
          <label className="font-label-caps mb-2 block text-outline">Why do you want to teach on FORGE?</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            required
            rows={4}
            className="w-full rounded-lg border border-subtle bg-surface-container-low px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none"
            placeholder="Describe your skills and what you'll teach…"
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Submitting…' : 'Submit application'}
        </Button>
        <Link href="/" className="block text-center text-sm text-on-surface-variant hover:text-primary">
          Back to home
        </Link>
      </form>
    </main>
  );
}
