import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search videos, channels, playlists, and courses on FORGE.',
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
