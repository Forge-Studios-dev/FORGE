import { Metadata } from 'next';
import { PodcastsListing } from './PodcastsListing';

export const metadata: Metadata = {
  title: 'Podcasts',
  description: 'Browse podcast series on FORGE — skill-first audio learning.',
};

export default function PodcastsPage() {
  return <PodcastsListing />;
}
