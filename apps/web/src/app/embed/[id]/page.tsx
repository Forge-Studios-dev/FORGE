import { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { isAxiosError } from 'axios';
import { StatusPage } from '@forge/design-system';
import { serverApi } from '@/lib/api';
import { Video } from '@/types';
import { EmbedPlayer } from '@/components/watch/EmbedPlayer';

export const dynamic = 'force-dynamic';

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
  if (lookup.status === 'unavailable') {
    return { title: 'Video unavailable', robots: { index: false, follow: false } };
  }
  if (lookup.status !== 'ok') {
    return { title: 'Embed', robots: { index: false, follow: false } };
  }
  return {
    title: lookup.video.title,
    robots: { index: false, follow: false },
  };
}

export default async function EmbedPage({ params }: Props) {
  const lookup = await lookupVideo(params.id);
  if (lookup.status === 'unavailable') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-4">
        <StatusPage
          icon="block"
          title="This video is not available"
          description="Playback is restricted for this video on your account."
        />
      </main>
    );
  }
  if (lookup.status !== 'ok') notFound();
  if (lookup.video.visibility === 'private') notFound();

  return (
    <main className="min-h-screen bg-black">
      <EmbedPlayer video={lookup.video} />
    </main>
  );
}
