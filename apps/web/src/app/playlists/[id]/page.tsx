import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/api';
import Link from 'next/link';
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
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{playlist.title}</h1>
            <p className="text-sm text-gray-400 mt-1">
              {playlist.items?.length || 0} videos
            </p>
          </div>
          <Link
            href="/playlists/new"
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-4 py-2 rounded-lg transition"
          >
            New playlist
          </Link>
        </div>

        <div className="mt-8 space-y-3">
          {playlist.items && playlist.items.length > 0 ? (
            playlist.items.map((item) => (
              <Link
                key={item.id}
                href={`/watch/${item.videoId}`}
                className="block glass rounded-xl p-4 border border-white/10 hover:bg-white/5 transition"
              >
                <p className="font-semibold">{item.video.title}</p>
                <p className="text-sm text-gray-400 mt-1">
                  by {item.video.user.displayName}
                </p>
              </Link>
            ))
          ) : (
            <div className="glass rounded-xl p-6 border border-white/10">
              <p className="text-gray-400">No videos yet.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

