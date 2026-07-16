import { StatusPage } from '@forge/design-system';

export default function PlaylistNotFound() {
  return (
    <StatusPage
      icon="playlist_remove"
      title="Playlist not found"
      description="This playlist may have been deleted, made private, or the link is out of date."
      action={{ label: 'Explore', href: '/explore' }}
      secondary={{ label: 'Back home', href: '/' }}
    />
  );
}
