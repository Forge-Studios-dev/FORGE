import { Metadata } from 'next';
import { serverApi } from '@/lib/api';
import { HomePageContent } from '@/components/home/HomePageContent';
import { Category, PaginatedResponse, Video } from '@/types';

/** ISR: shell + category list; personalized sort handled client-side in FeedGrid. */
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'FORGE – Learn from Creators',
  description: 'Discover skill-based tutorials and live sessions from expert creators.',
};

async function getInitialFeed(): Promise<PaginatedResponse<Video>> {
  try {
    const { data } = await serverApi.get('/videos/feed?limit=12&sort=latest');
    return data.data;
  } catch {
    return { data: [], meta: { cursor: null, hasMore: false } };
  }
}

async function getTrendingFeed(): Promise<PaginatedResponse<Video>> {
  try {
    const { data } = await serverApi.get('/videos/feed/trending?limit=8');
    return data.data;
  } catch {
    return { data: [], meta: { cursor: null, hasMore: false } };
  }
}

async function getCategories(): Promise<Category[]> {
  try {
    const { data } = await serverApi.get('/categories');
    return data.data;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [feed, trending, categories] = await Promise.all([
    getInitialFeed(),
    getTrendingFeed(),
    getCategories(),
  ]);

  return <HomePageContent feed={feed} trending={trending} categories={categories} />;
}
