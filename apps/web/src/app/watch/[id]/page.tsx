import { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { isAxiosError } from 'axios';
import { StatusPage } from '@forge/design-system';

export const dynamic = 'force-dynamic';
import { serverApi } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import { Video } from '@/types';
import { WatchPageClient } from '@/components/watch/WatchPageClient';
import { RelatedVideos } from '@/components/watch/RelatedVideos';
import { JsonLd } from '@/components/seo/JsonLd';

/** Seconds -> ISO 8601 duration (schema.org VideoObject.duration format). */
function toIso8601Duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `PT${h > 0 ? `${h}H` : ''}${m > 0 ? `${m}M` : ''}${s}S`;
}

interface Props {
  params: { id: string };
}

type VideoLookup =
  | { status: 'ok'; video: Video }
  | { status: 'not_found' }
  | { status: 'unavailable' };

const lookupVideo = cache(async (id: string): Promise<VideoLookup> => {
  try {
    const { data } = await serverApi.get(`/videos/${id}`);
    return { status: 'ok', video: data.data as Video };
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 403) {
      return { status: 'unavailable' };
    }
    return { status: 'not_found' };
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lookup = await lookupVideo(params.id);
  if (lookup.status === 'unavailable') return { title: 'Video unavailable' };
  if (lookup.status !== 'ok') return { title: 'Video not found' };
  const video = lookup.video;

  return {
    title: video.title,
    description: video.description || `Watch ${video.title} on FORGE`,
    openGraph: {
      title: video.title,
      description: video.description,
      images: video.thumbnailUrl ? [{ url: video.thumbnailUrl }] : [],
      type: 'video.other',
    },
    twitter: {
      card: 'summary_large_image',
      title: video.title,
      description: video.description,
      images: video.thumbnailUrl ? [video.thumbnailUrl] : [],
    },
  };
}

export default async function WatchPage({ params }: Props) {
  const lookup = await lookupVideo(params.id);
  if (lookup.status === 'unavailable') {
    return (
      <StatusPage
        icon="block"
        title="This video is not available"
        description="Playback is restricted for this video on your account."
        action={{ label: 'Go home', href: '/' }}
        secondary={{ label: 'Explore', href: '/explore' }}
      />
    );
  }
  if (lookup.status !== 'ok') notFound();
  const video = lookup.video;

  const skillTag = video.skillTags?.[0]?.name;
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          name: video.title,
          description: video.description || video.title,
          thumbnailUrl: video.thumbnailUrl ? [video.thumbnailUrl] : undefined,
          uploadDate: video.publishedAt || video.createdAt,
          duration: video.durationSeconds ? toIso8601Duration(video.durationSeconds) : undefined,
          contentUrl: video.hlsUrl,
          embedUrl: `${SITE_URL}/watch/${video.id}`,
          interactionStatistic: {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/WatchAction',
            userInteractionCount: video.viewCount,
          },
        }}
      />
      <WatchPageClient
        video={video}
        sidebar={
          <RelatedVideos
            videoId={video.id}
            creatorId={video.userId}
            skillTag={skillTag}
          />
        }
      />
    </>
  );
}
