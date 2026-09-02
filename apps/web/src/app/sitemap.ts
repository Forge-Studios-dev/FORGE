import { MetadataRoute } from 'next';
import { serverApi } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import { PaginatedResponse, Video } from '@/types';

export const revalidate = 3600; // hourly — balances SEO freshness against API load

// Bounded fetch — sitemap doesn't need every video ever uploaded, and an
// unbounded crawl here would be an unbounded API load on every regeneration.
const MAX_VIDEO_PAGES = 10;
const PAGE_SIZE = 50;

type UploadCategoryOption = {
  slug: string;
  skillTags?: Array<{ slug: string }>;
};

async function fetchPublicVideos(): Promise<Video[]> {
  const videos: Video[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_VIDEO_PAGES; page++) {
    try {
      const { data } = await serverApi.get('/videos/public', {
        params: { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
      });
      const feed: PaginatedResponse<Video> = data.data;
      if (!feed?.data || !Array.isArray(feed.data)) break;
      videos.push(...feed.data);
      if (!feed.meta?.hasMore || !feed.meta?.cursor) break;
      cursor = feed.meta.cursor;
    } catch {
      break;
    }
  }
  return videos;
}

async function fetchCategorySlugs(): Promise<string[]> {
  try {
    const { data } = await serverApi.get('/categories/upload-options');
    const categories: UploadCategoryOption[] = Array.isArray(data.data) ? data.data : [];
    return categories.map((c) => c.slug).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchFeaturedCourseIds(): Promise<string[]> {
  try {
    const { data } = await serverApi.get('/courses/discover/featured', { params: { limit: 50 } });
    const courses: Array<{ id: string }> = data.data ?? [];
    return courses.map((c) => c.id).filter(Boolean);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [videos, categorySlugs, courseIds] = await Promise.all([
    fetchPublicVideos(),
    fetchCategorySlugs(),
    fetchFeaturedCourseIds(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/explore`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/trending`, changeFrequency: 'hourly', priority: 0.85 },
    { url: `${SITE_URL}/shorts`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/search`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/subscriptions`, changeFrequency: 'daily', priority: 0.6 },
  ];

  const courseRoutes: MetadataRoute.Sitemap =
    courseIds.length > 0
      ? [
          { url: `${SITE_URL}/discover/courses`, changeFrequency: 'daily', priority: 0.75 },
          ...courseIds.map((id) => ({
            url: `${SITE_URL}/courses/${id}`,
            changeFrequency: 'weekly' as const,
            priority: 0.65,
          })),
        ]
      : [];

  const categoryRoutes: MetadataRoute.Sitemap = categorySlugs.map((slug) => ({
    url: `${SITE_URL}/explore/${slug}`,
    changeFrequency: 'daily',
    priority: 0.6,
  }));

  const videoRoutes: MetadataRoute.Sitemap = videos.map((video) => ({
    url:
      video.videoType === 'short'
        ? `${SITE_URL}/shorts?v=${video.id}`
        : `${SITE_URL}/watch/${video.id}`,
    lastModified: video.publishedAt || video.createdAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const creatorUsernames = new Set(
    videos.map((v) => v.user?.username).filter((u): u is string => !!u),
  );
  const creatorRoutes: MetadataRoute.Sitemap = [...creatorUsernames].map((username) => ({
    url: `${SITE_URL}/${username}`,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...courseRoutes, ...videoRoutes, ...creatorRoutes];
}
