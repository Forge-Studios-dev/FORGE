'use client';

import Image from 'next/image';
import Link from 'next/link';
import { User } from '@/types';
import { formatCount } from '@/lib/utils';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getAccessToken, getRefreshToken, persistAuthSession } from '@/lib/auth-storage';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthGateModal } from '@/components/gates/AuthGateModal';

interface Props {
  user: User;
}

export function ProfileHeader({ user }: Props) {
  const router = useRouter();
  const { user: me, isGuest, canEngage, canApplyForCreator, refresh } = useAuth();
  const [authGate, setAuthGate] = useState(false);
  const followMutation = useMutation({
    mutationFn: () => api.post(`/follow/${user.id}`),
  });

  const requestCreatorMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/users/me/request-creator');
      return data.data as User;
    },
    onSuccess: (updatedUser) => {
      const access = getAccessToken();
      const refreshTok = getRefreshToken();
      if (access && refreshTok) {
        persistAuthSession(access, refreshTok, JSON.stringify(updatedUser));
      }
      refresh();
      router.push('/waiting-approval');
    },
  });

  const isOwnProfile = !!me?.id && me.id === user.id;

  return (
    <div className="relative">
      {user.bannerUrl ? (
        <div className="h-48 sm:h-64 relative overflow-hidden">
          <Image src={user.bannerUrl} alt="Banner" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-primary/80 to-transparent" />
        </div>
      ) : (
        <div className="h-40 bg-gradient-to-br from-primary/20 via-surface-container to-secondary/10" />
      )}

      <div className="mx-auto max-w-[var(--spacing-container-max)] px-5 md:px-12">
        <div className="relative -mt-16 flex items-end gap-5 border-b border-outline-variant/20 pb-6">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.displayName}
              width={96}
              height={96}
              className="rounded-2xl object-cover border-4 border-surface-primary"
            />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-forge-600 flex items-center justify-center text-3xl text-white font-bold border-4 border-surface-primary">
              {user.displayName[0]}
            </div>
          )}

          <div className="flex-1 min-w-0 pb-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold truncate">{user.displayName}</h1>
              {user.isVerified && (
                <span className="text-forge-400 text-sm bg-forge-500/10 border border-forge-500/20 px-2 py-0.5 rounded-full">
                  Verified
                </span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant">@{user.username}</p>
          </div>

          {isOwnProfile ? (
            <Link
              href="/profile/settings"
              className="shrink-0 rounded-xl border border-outline-variant px-6 py-2 font-semibold text-on-surface transition hover:border-primary"
            >
              Settings
            </Link>
          ) : (
            <button
              onClick={() => {
                if (!canEngage) {
                  setAuthGate(true);
                  return;
                }
                followMutation.mutate();
              }}
              disabled={followMutation.isPending}
              className="primary-button shrink-0 rounded-xl px-6 py-2 font-semibold text-on-primary disabled:opacity-60"
            >
              Follow
            </button>
          )}
        </div>

        {isOwnProfile && canApplyForCreator && (
          <div className="mt-4">
            <button
              onClick={() => requestCreatorMutation.mutate()}
              disabled={requestCreatorMutation.isPending}
              className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2 font-semibold text-on-surface transition hover:border-primary disabled:opacity-60"
            >
              {requestCreatorMutation.isPending ? 'Submitting…' : 'Become a creator'}
            </button>
          </div>
        )}

        <div className="flex gap-8 py-5 text-sm">
          <div className="text-center">
            <p className="font-bold text-lg">{formatCount(user.followerCount)}</p>
            <p className="text-on-surface-variant">Followers</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">{formatCount(user.followingCount)}</p>
            <p className="text-on-surface-variant">Following</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">{formatCount(user.videoCount)}</p>
            <p className="text-on-surface-variant">Videos</p>
          </div>
        </div>

        {user.bio && (
          <p className="max-w-2xl pb-6 text-sm leading-relaxed text-on-surface-variant">{user.bio}</p>
        )}
      </div>

      <AuthGateModal
        open={authGate}
        onClose={() => setAuthGate(false)}
        message="Sign in to follow creators."
      />
    </div>
  );
}
