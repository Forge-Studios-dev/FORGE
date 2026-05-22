import { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { serverApi } from '@/lib/api';
import { Video } from '@/types';
import { WatchPageClient } from '@/components/watch/WatchPageClient';

interface Props {
  params: { id: string };
}

async function getVideo(id: string): Promise<Video | null> {
  try {
    const { data } = await serverApi.get(`/videos/${id}`);
    return data.data;
  } catch {
    return null;
  }
}

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

  return <WatchPageClient video={video} />;
}
