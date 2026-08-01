import { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';

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

const getVideo = cache(async (id: string): Promise<Video | null> => {
  try {
    const { data } = await serverApi.get(`/videos/${id}`);
    return data.data;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const video = await getVideo(params.id);
  if (!video) return { title: 'Video not found' };

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
  const video = await getVideo(params.id);
  if (!video) notFound();

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
