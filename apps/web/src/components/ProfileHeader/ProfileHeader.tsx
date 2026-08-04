'use client';

import { Avatar } from '@forge/design-system';
import { User } from '@/types';
import { formatCount } from '@/lib/utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getAccessToken, persistAuthSession } from '@/lib/auth-storage';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthGateModal } from '@/components/gates/AuthGateModal';
import { VerifyEmailGateModal } from '@/components/gates/VerifyEmailGateModal';
import {
  engageBlockedMessage,
  type EngageBlockReason,
} from '@/lib/engage-access';
import { SubscribeChannelControl } from '@/components/SubscribeChannelControl/SubscribeChannelControl';
import { ReportContentButton } from '@/components/watch/ReportContentButton';
import Image from 'next/image';
import Link from 'next/link';

interface Props {
  user: User;
}

export function ProfileHeader({ user }: Props) {
  const router = useRouter();
  const { user: me, isGuest, canApplyForCreator, refresh } = useAuth();
  const [engageBlock, setEngageBlock] = useState<EngageBlockReason | null>(null);
  const [engageError, setEngageError] = useState<string | null>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const isOwnProfile = !!me?.id && me.id === user.id;

  const { data: subscribed = !!(user.viewerSubscribed ?? user.viewerFollowing) } = useQuery({
    queryKey: ['profile-subscribe', user.id, me?.id],
    enabled: !isGuest && !!me && !isOwnProfile,
    queryFn: async () => {
      const { data } = await api.get<{ data: User }>(`/users/by-username/${user.username}`);
      return !!(data.data.viewerSubscribed ?? data.data.viewerFollowing);
    },
    initialData: !!(user.viewerSubscribed ?? user.viewerFollowing),
  });

  const requestCreatorMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/users/me/request-creator');
      return data.data as User;
    },
    onSuccess: (updatedUser) => {
      const access = getAccessToken();
      if (access) {
        persistAuthSession(access, undefined, JSON.stringify(updatedUser));
      }
      refresh();
      router.push('/waiting-approval');
    },
  });

  const subscriberCount = user.subscriberCount ?? user.followerCount;

  return (
    <div className="relative">
      {user.bannerUrl ? (
        <div className="relative h-48 overflow-hidden sm:h-64">
          <Image src={user.bannerUrl} alt="Banner" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-primary/80 to-transparent" />
        </div>
      ) : (
        <div className="h-40 bg-gradient-to-br from-primary/20 via-surface-container to-secondary/10" />
      )}

      <div className="mx-auto max-w-[var(--spacing-container-max)] px-5 md:px-12">
        <div className="relative -mt-16 flex items-end gap-5 border-b border-outline-variant/20 pb-6">
          <Avatar
            src={user.avatarUrl}
            name={user.displayName}
            size="xl"
            className="!h-24 !w-24 rounded-2xl border-4 border-surface-primary text-3xl"
          />

          <div className="min-w-0 flex-1 pb-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-bold">{user.displayName}</h1>
              {user.isVerified && (
                <span className="rounded-full border border-forge-500/20 bg-forge-500/10 px-2 py-0.5 text-sm text-forge-400">
                  Verified
                </span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant">@{user.username}</p>
          </div>

          {isOwnProfile ? (
            <Link
              href="/studio/branding"
              className="shrink-0 rounded-xl border border-outline-variant px-6 py-2 font-semibold text-on-surface transition hover:border-primary"
            >
              Customize channel
            </Link>
          ) : (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <SubscribeChannelControl
                channelId={user.id}
                initialSubscribed={subscribed}
                variant="channel"
                onEngageBlock={setEngageBlock}
                onEngageError={setEngageError}
              />
              <button
                type="button"
                onClick={async () => {
                  const url = `${window.location.origin}/${user.username}`;
                  try {
                    if (navigator.share) {
                      await navigator.share({ title: user.displayName, url });
                      return;
                    }
                  } catch {
                    /* fall through */
                  }
                  if (navigator.clipboard) {
                    await navigator.clipboard.writeText(url);
                    setShareHint('Channel link copied');
                    setTimeout(() => setShareHint(null), 2000);
                  }
                }}
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary hover:text-on-surface"
              >
                Share
              </button>
              <ReportContentButton
                targetType="user"
                targetId={user.id}
                className="rounded-xl px-3 py-2 text-sm text-on-surface-variant hover:text-error"
              />
            </div>
          )}
        </div>

        {shareHint ? (
          <p className="mt-2 text-sm text-secondary" role="status">
            {shareHint}
          </p>
        ) : null}

        {engageError ? (
          <p className="mt-2 text-sm text-error" role="alert">
            {engageError}
          </p>
        ) : null}

        {isOwnProfile && canApplyForCreator && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => requestCreatorMutation.mutate()}
              disabled={requestCreatorMutation.isPending}
              className="rounded-xl border border-outline-variant bg-surface-container-high px-4 py-2 font-semibold text-on-surface transition hover:border-primary disabled:opacity-60"
            >
              {requestCreatorMutation.isPending ? 'Submitting…' : 'Become a creator'}
            </button>
          </div>
        )}

        <div className="flex gap-8 py-5 text-sm">
          <Link href={`/${user.username}/subscribers`} className="text-center hover:text-primary">
            <p className="text-lg font-bold">{formatCount(subscriberCount)}</p>
            <p className="text-on-surface-variant">Subscribers</p>
          </Link>
          <Link href={`/${user.username}/subscriptions`} className="text-center hover:text-primary">
            <p className="text-lg font-bold">
              {formatCount(user.subscriptionCount ?? user.followingCount)}
            </p>
            <p className="text-on-surface-variant">Subscriptions</p>
          </Link>
          <div className="text-center">
            <p className="text-lg font-bold">{formatCount(user.videoCount)}</p>
            <p className="text-on-surface-variant">Videos</p>
          </div>
        </div>
      </div>

      <AuthGateModal
        open={engageBlock === 'guest'}
        onClose={() => setEngageBlock(null)}
        message={engageBlockedMessage('guest')}
      />
      <VerifyEmailGateModal
        open={engageBlock === 'unverified'}
        onClose={() => setEngageBlock(null)}
        message={engageBlockedMessage('unverified')}
      />
    </div>
  );
}
