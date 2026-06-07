import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/api';
import Link from 'next/link';
import { Icon } from '@forge/design-system';
import { Playlist } from '@/types';

interface Props {
  params: { id: string };
}

async function getPlaylist(id: string): Promise<Playlist | null> {
  try {
    const { data } = await serverApi.get(`/playlists/${id}`);
    return data.data;
  } catch {
    return null;
  }
}

export default async function PlaylistPage({ params }: Props) {
  const playlist = await getPlaylist(params.id);
  if (!playlist) notFound();

  return (
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="font-display-forge text-2xl font-bold">{playlist.title}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {playlist.items?.length || 0} lessons
          </p>
        </div>
        <Link
          href="/playlists/new"
          className="primary-button rounded-full px-5 py-2 text-sm font-semibold text-on-primary"
        >
          New playlist
        </Link>
      </div>

      <ul className="space-y-3">
        {playlist.items?.map((item) => (
          <li key={item.id}>
            <Link
              href={`/watch/${item.videoId}`}
              className="glass-panel flex items-center gap-4 rounded-xl p-4 transition hover:border-primary/30"
            >
              <Icon name="play_circle" className="text-2xl text-primary" />
              <span className="font-medium">{item.video?.title ?? 'Lesson'}</span>
            </Link>
          </li>
        ))}
        {!playlist.items?.length && (
          <li className="glass-panel rounded-xl p-10 text-center text-on-surface-variant">
            This playlist is empty.
          </li>
        )}
      </ul>
    </main>
  );
}
