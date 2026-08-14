import { Metadata } from 'next';

// page.tsx here is a client component (search UI) — static metadata for a
// route segment must come from a layout when the page itself can't export it.
export const metadata: Metadata = {
  title: 'Discover communities',
  description: 'Search and browse creator communities on FORGE.',
};

export default function DiscoverCommunitiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
