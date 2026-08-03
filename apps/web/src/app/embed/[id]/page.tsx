import { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/api';
import { Video } from '@/types';
import { EmbedPlayer } from '@/components/watch/EmbedPlayer';

export const dynamic = 'force-dynamic';

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
  if (!video) return { title: 'Embed', robots: { index: false, follow: false } };
  return {
    title: video.title,
    robots: { index: false, follow: false },
  };
}

export default async function EmbedPage({ params }: Props) {
  const video = await getVideo(params.id);
  if (!video) notFound();
  if (video.visibility === 'private') notFound();

  return (
    <main className="min-h-screen bg-black">
      <EmbedPlayer video={video} />
    </main>
  );
}
