'use client';

import { useState } from 'react';
import { Video } from '@/types';
import { VideoPlayer } from '@/components/VideoPlayer/VideoPlayer';
import { VideoInfo } from '@/components/VideoPlayer/VideoInfo';
import { CommentsPanel } from '@/components/Comments/CommentsPanel';
import { RelatedVideos } from '@/components/watch/RelatedVideos';
import { AuthGateModal } from '@/components/gates/AuthGateModal';
import { ReportContentButton } from '@/components/watch/ReportContentButton';
import { NoAccessCallout } from '@/components/NoAccessCallout';
import { useAuth } from '@/lib/auth';

export function WatchExperience({ video }: { video: Video }) {
  const { isGuest, canEngage } = useAuth();
  const [authGate, setAuthGate] = useState(false);
  const skillTag = video.skillTags?.[0]?.name;
  const canPlay = video.status === 'ready' && !!video.hlsUrl;
  const isPrivate = video.visibility === 'private';

  if (isPrivate && isGuest) {
    return (
      <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
        <NoAccessCallout
          title="Private lesson"
          description="This content is only available to signed-in viewers with access."
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
              <VideoInfo video={video} onGuestAction={!canEngage ? () => setAuthGate(true) : undefined} />
            </div>
            <ReportContentButton targetType="video" targetId={video.id} />
          </div>
          <CommentsPanel
            videoId={video.id}
            commentCount={video.commentCount}
            onGuestInteract={!canEngage ? () => setAuthGate(true) : undefined}
          />
        </div>
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <h2 className="font-label-caps text-outline">Up next</h2>
          <RelatedVideos videoId={video.id} creatorId={video.userId} skillTag={skillTag} />
        </aside>
      </div>
      <AuthGateModal
        open={authGate}
        onClose={() => setAuthGate(false)}
        message="Sign in to interact with this lesson."
      />
    </main>
  );
}
