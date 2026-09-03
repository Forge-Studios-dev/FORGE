import type { Metadata } from 'next';
import { cache } from 'react';
import { isAxiosError } from 'axios';
import { serverApi } from '@/lib/api';
import { SITE_URL } from '@/lib/site';

type StreamMeta = {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  status?: string;
  creator?: { displayName?: string; username?: string };
};

const lookupStream = cache(async (id: string): Promise<StreamMeta | null> => {
  try {
    const { data } = await serverApi.get(`/streams/${id}`);
    return (data.data as StreamMeta) ?? null;
  } catch (err) {
    if (isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 403)) {
      return null;
    }
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const stream = await lookupStream(params.id);
  if (!stream) {
    return {
      title: 'Live stream',
      description: 'Watch a live FORGE stream.',
    };
  }

  const creator =
    stream.creator?.displayName || stream.creator?.username
      ? ` · ${stream.creator.displayName || `@${stream.creator.username}`}`
      : '';
  const title = stream.title;
  const description =
    stream.description?.trim() ||
    `${stream.status === 'live' ? 'Watch live' : 'Watch'} on FORGE${creator}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/live/${stream.id}`,
      images: stream.thumbnailUrl ? [{ url: stream.thumbnailUrl }] : [],
      type: 'website',
    },
    twitter: {
      card: stream.thumbnailUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      images: stream.thumbnailUrl ? [stream.thumbnailUrl] : [],
    },
  };
}

export default function LiveWatchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
