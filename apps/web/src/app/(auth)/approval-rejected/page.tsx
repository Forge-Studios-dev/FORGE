'use client';

import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type StoredUser = {
  displayName?: string;
  creatorStatus?: 'pending' | 'approved' | 'rejected' | null;
  creatorReviewNote?: string | null;
};

function getUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('forge_user') || 'null') as StoredUser | null;
  } catch {
    return null;
  }
}

export default function ApprovalRejectedPage() {
  const router = useRouter();
  const user = getUser();

  const reRequest = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/users/me/request-creator');
      return data.data;
    },
    onSuccess: (updatedUser) => {
      localStorage.setItem('forge_user', JSON.stringify(updatedUser));
      router.push('/waiting-approval');
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg glass rounded-2xl p-8">
        <h1 className="text-2xl font-bold">Creator request rejected</h1>
        <p className="text-gray-400 mt-2">
          {user?.displayName ? `${user.displayName}, ` : ''}
          your creator request was rejected.
        </p>

        {user?.creatorReviewNote ? (
          <div className="mt-5 bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-sm text-gray-300 font-semibold">Reason</p>
            <p className="text-sm text-gray-400 mt-1">{user.creatorReviewNote}</p>
          </div>
        ) : null}

        <div className="mt-6 flex gap-3 flex-wrap">
          <button
            onClick={() => reRequest.mutate()}
            disabled={reRequest.isPending}
            className="bg-forge-600 hover:bg-forge-500 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg transition"
          >
            {reRequest.isPending ? 'Submitting…' : 'Request again'}
          </button>
          <Link
            href="/"
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-5 py-2.5 rounded-lg transition"
          >
            Go to home
          </Link>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          Need help? Contact an admin or try again after updating your profile.
        </p>
      </div>
    </div>
  );
}

