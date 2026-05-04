'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AuthTokens } from '@/types';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', username: '', displayName: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<{ data: AuthTokens }>('/auth/signup', form);
      localStorage.setItem('forge_access_token', data.data.accessToken);
      localStorage.setItem('forge_refresh_token', data.data.refreshToken);
      localStorage.setItem('forge_user', JSON.stringify(data.data.user));
      router.push('/');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient">FORGE</h1>
          <p className="text-gray-400 mt-2">Start your learning journey</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {[
            { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
            { key: 'username', label: 'Username', type: 'text', placeholder: 'john_doe' },
            { key: 'displayName', label: 'Display Name', type: 'text', placeholder: 'John Doe' },
            { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">{field.label}</label>
              <input
                type={field.type}
                required
                value={form[field.key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-forge-500 transition"
                placeholder={field.placeholder}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-forge-600 hover:bg-forge-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-forge-500 hover:text-forge-400">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
