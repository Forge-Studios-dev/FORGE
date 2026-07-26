import { MetadataRoute } from 'next';
import { serverApi } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import { PaginatedResponse, Video } from '@/types';

export const revalidate = 3600; // hourly — balances SEO freshness against API load

// Bounded fetch — sitemap doesn't need every video ever uploaded, and an
// unbounded crawl here would be an unbounded API load on every regeneration.
const MAX_VIDEO_PAGES = 10;
const PAGE_SIZE = 50;

// Courses have no bulk-paginated public endpoint yet (only featured/search) —
// reuse the featured endpoint at its own max cap, same bounded-fetch pattern
// as videos above. Revisit if/when a paginated `courses/discover` list ships.
const MAX_FEATURED_COURSES = 24;

type SitemapCourse = { id: string; createdAt?: string };

type UploadCategoryOption = {
  slug: string;
  skillTags: Array<{ slug: string }>;
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
      videos.push(...feed.data);
      if (!feed.meta.hasMore || !feed.meta.cursor) break;
      cursor = feed.meta.cursor;
    } catch {
      break;
    }
  }
  return videos;
}

async function fetchPublicCourses(): Promise<SitemapCourse[]> {
  try {
    const { data } = await serverApi.get('/courses/discover/featured', {
      params: { limit: MAX_FEATURED_COURSES },
    });
    return data.data ?? [];
  } catch {
    return [];
  }
}

async function fetchSkillTagSlugs(): Promise<string[]> {
  try {
    const { data } = await serverApi.get('/categories/upload-options');
    const categories: UploadCategoryOption[] = data.data ?? [];
    const slugs = new Set<string>();
    for (const category of categories) {
      for (const tag of category.skillTags) slugs.add(tag.slug);
    }
    return [...slugs];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [videos, skillTagSlugs, courses] = await Promise.all([
    fetchPublicVideos(),
    fetchSkillTagSlugs(),
    fetchPublicCourses(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/explore`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/discover/courses`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/discover/communities`, changeFrequency: 'daily', priority: 0.7 },
  ];

  const skillRoutes: MetadataRoute.Sitemap = skillTagSlugs.map((slug) => ({
    url: `${SITE_URL}/explore/skills/${slug}`,
    changeFrequency: 'daily',
    priority: 0.6,
  }));

  const videoRoutes: MetadataRoute.Sitemap = videos.map((video) => ({
    url: `${SITE_URL}/watch/${video.id}`,
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

  const courseRoutes: MetadataRoute.Sitemap = courses.map((course) => ({
    url: `${SITE_URL}/courses/${course.id}`,
    lastModified: course.createdAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...skillRoutes, ...videoRoutes, ...creatorRoutes, ...courseRoutes];
}
