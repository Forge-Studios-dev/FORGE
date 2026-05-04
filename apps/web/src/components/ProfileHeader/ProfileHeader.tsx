'use client';

import Image from 'next/image';
import { User } from '@/types';
import { formatCount } from '@/lib/utils';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Props {
  user: User;
}

export function ProfileHeader({ user }: Props) {
  const followMutation = useMutation({
    mutationFn: () => api.post(`/follow/${user.id}`),
  });

  return (
    <div className="relative">
      {user.bannerUrl ? (
        <div className="h-48 sm:h-64 relative overflow-hidden">
          <Image src={user.bannerUrl} alt="Banner" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-primary/80 to-transparent" />
        </div>
      ) : (
        <div className="h-40 bg-gradient-to-br from-forge-900/50 via-surface-secondary to-purple-900/30" />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 flex items-end gap-5 pb-6 border-b border-white/5">
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
            <p className="text-gray-400 text-sm">@{user.username}</p>
          </div>

          <button
            onClick={() => followMutation.mutate()}
            disabled={followMutation.isPending}
            className="shrink-0 bg-forge-600 hover:bg-forge-500 disabled:opacity-60 text-white font-semibold px-6 py-2 rounded-xl transition"
          >
            Follow
          </button>
        </div>

        <div className="flex gap-8 py-5 text-sm">
          <div className="text-center">
            <p className="font-bold text-lg">{formatCount(user.followerCount)}</p>
            <p className="text-gray-400">Followers</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">{formatCount(user.followingCount)}</p>
            <p className="text-gray-400">Following</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">{formatCount(user.videoCount)}</p>
            <p className="text-gray-400">Videos</p>
          </div>
        </div>

        {user.bio && (
          <p className="text-gray-300 text-sm leading-relaxed pb-6 max-w-2xl">{user.bio}</p>
        )}
      </div>
    </div>
  );
}
