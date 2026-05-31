'use client';

import { useState } from 'react';
import { Video } from '@/types';
import { VideoPlayer } from '@/components/VideoPlayer/VideoPlayerLazy';
import { VideoInfo } from '@/components/VideoPlayer/VideoInfo';
import { CommentsPanel } from '@/components/Comments/CommentsPanel';
import { AuthGateModal } from '@/components/gates/AuthGateModal';
import { VerifyEmailGateModal } from '@/components/gates/VerifyEmailGateModal';
import {
  engageBlockedMessage,
  getEngageBlockReason,
  type EngageBlockReason,
} from '@/lib/engage-access';
import { ReportContentButton } from '@/components/watch/ReportContentButton';
import { NoAccessCallout } from '@/components/NoAccessCallout';
import { useAuth } from '@/lib/auth';

export function WatchExperience({
  video,
  sidebar,
}: {
  video: Video;
  sidebar?: React.ReactNode;
}) {
  const { isGuest, user } = useAuth();
  const [engageBlock, setEngageBlock] = useState<EngageBlockReason | null>(null);
  const blockReason = getEngageBlockReason(user, isGuest);
  const onEngageBlocked = blockReason ? () => setEngageBlock(blockReason) : undefined;
  const canPlay = video.status === 'ready' && !!video.hlsUrl;
  const isPrivate = video.visibility === 'private';
  const isOwner = user?.id === video.userId;

  if (isPrivate && (isGuest || !isOwner)) {
    return (
      <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
        <NoAccessCallout
          title="Private lesson"
          description={
            isGuest
              ? 'Sign in with the creator account that owns this lesson to watch it.'
              : 'You do not have permission to watch this private lesson.'
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[var(--spacing-container-max)] px-5 py-6 md:px-12 md:py-8">
      <div className="forge-fade-in grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="min-w-0 space-y-6">
          {canPlay ? (
            <VideoPlayer
              videoId={video.id}
              hlsUrl={video.hlsUrl!}
              thumbnailUrl={video.thumbnailUrl}
              title={video.title}
            />
          ) : (
            <div className="glass-panel flex aspect-video flex-col items-center justify-center rounded-xl p-8 text-center">
              <p className="font-display-forge text-lg font-semibold">
                {video.status === 'processing' ? 'Processing your lesson' : 'Playback not available'}
              </p>
              <p className="mt-2 text-sm text-on-surface-variant">
                {video.status === 'processing'
                  ? 'This video is being transcoded. Check back soon.'
                  : video.status === 'failed'
                    ? 'This upload could not be processed.'
                    : 'This lesson is not ready for playback yet.'}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <VideoInfo video={video} onGuestAction={onEngageBlocked} />
            </div>
            <ReportContentButton targetType="video" targetId={video.id} />
          </div>
          <CommentsPanel
            videoId={video.id}
            commentCount={video.commentCount}
            onGuestInteract={onEngageBlocked}
          />
        </div>
        {sidebar ? (
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <h2 className="font-label-caps text-outline">Up next</h2>
            {sidebar}
          </aside>
        ) : null}
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
    </main>
  );
}
