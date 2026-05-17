'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, PageHeader } from '@forge/design-system';
import { api } from '@/lib/api';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.email.trim() || !form.email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<{
        data: { accessToken: string; refreshToken: string; user: { role: string } };
      }>('/auth/login', form);
      if (data.data.user.role !== 'admin') {
        router.push('/unauthorized');
        return;
      }
      localStorage.setItem('forge_admin_token', data.data.accessToken);
      localStorage.setItem('forge_admin_refresh_token', data.data.refreshToken);
      document.cookie = `forge_admin_token=${encodeURIComponent(data.data.accessToken)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      const next = searchParams.get('next');
      router.push(next && next.startsWith('/') ? next : '/dashboard');
    } catch {
      setError('Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <PageHeader title="FORGE Admin" subtitle="Sign in to manage the platform" />
        <form onSubmit={handleSubmit} className="glass-panel space-y-5 rounded-2xl p-8">
          {error && <p className="text-sm text-error">{error}</p>}
          <div>
            <label className="font-label-caps mb-2 block text-outline">Email</label>
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="font-label-caps mb-2 block text-outline">Password</label>
            <Input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-on-surface-variant">Loading…</div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
