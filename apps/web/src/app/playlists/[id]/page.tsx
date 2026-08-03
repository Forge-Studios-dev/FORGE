import { PlaylistDetailClient } from '@/components/playlists/PlaylistDetailClient';

interface Props {
  params: { id: string };
}

export default function PlaylistPage({ params }: Props) {
  return <PlaylistDetailClient playlistId={params.id} />;
}
