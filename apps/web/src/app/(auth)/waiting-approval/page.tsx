'use client';

import Link from 'next/link';

function getUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('forge_user') || 'null') as
      | { role?: string; creatorStatus?: string; displayName?: string }
      | null;
  } catch {
    return null;
  }
}

export default function WaitingApprovalPage() {
  const user = getUser();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg glass rounded-2xl p-8">
        <h1 className="text-2xl font-bold">Creator approval pending</h1>
        <p className="text-gray-400 mt-2">
          {user?.displayName ? `${user.displayName}, ` : ''}
          your creator request is under review. You can still browse and watch videos while you wait.
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/"
            className="bg-forge-600 hover:bg-forge-500 text-white font-semibold px-5 py-2.5 rounded-lg transition"
          >
            Go to home
          </Link>
          <Link
            href="/login"
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-5 py-2.5 rounded-lg transition"
          >
            Switch account
          </Link>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          Status: <span className="text-gray-300">{user?.creatorStatus || 'pending'}</span>
        </p>
      </div>
    </div>
  );
}

