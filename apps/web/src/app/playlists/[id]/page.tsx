import { Metadata } from 'next';
import { cache } from 'react';
import { isAxiosError } from 'axios';
import { serverApi } from '@/lib/api';
import { Playlist } from '@/types';
import { PlaylistDetailClient } from '@/components/playlists/PlaylistDetailClient';

interface Props {
  params: { id: string };
}

type PlaylistLookup =
  | { status: 'ok'; playlist: Playlist }
  | { status: 'unavailable' };

const lookupPlaylist = cache(async (id: string): Promise<PlaylistLookup> => {
  try {
    const { data } = await serverApi.get(`/playlists/${id}`);
    return { status: 'ok', playlist: data.data as Playlist };
  } catch (err) {
    if (isAxiosError(err)) return { status: 'unavailable' };
    return { status: 'unavailable' };
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lookup = await lookupPlaylist(params.id);
  if (lookup.status !== 'ok') return { title: 'Playlist' };
  const playlist = lookup.playlist;
  const thumbnailUrl = playlist.items?.[0]?.video?.thumbnailUrl;
  const description =
    playlist.description || `A playlist of ${playlist.items?.length ?? 0} videos on FORGE`;

  return {
    title: playlist.title,
    description,
    openGraph: {
      title: playlist.title,
      description,
      images: thumbnailUrl ? [{ url: thumbnailUrl }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: playlist.title,
      description,
      images: thumbnailUrl ? [thumbnailUrl] : [],
    },
  };
}

export default function PlaylistPage({ params }: Props) {
  return <PlaylistDetailClient playlistId={params.id} />;
}
