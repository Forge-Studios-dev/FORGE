import { HomeFeedSections } from '@/components/home/HomeFeedSections';
import { LiveNowRail } from '@/components/home/LiveNowRail';
import { TrendingRail } from '@/components/home/TrendingRail';
import { ContinueWatching } from '@/components/ContinueWatching';
import { HomeFeedTabs } from '@/components/home/HomeFeedTabs';
import { FeaturedCoursesRail } from '@/components/Courses/FeaturedCoursesRail';
import { Category, PaginatedResponse, Video } from '@/types';

type Props = {
  feed: PaginatedResponse<Video>;
  trending: PaginatedResponse<Video>;
  categories: Category[];
};

/** Server-rendered homepage shell. The For you / Subscriptions tab toggle (and
 * everything whose content depends on it) is the only client island — see
 * HomeFeedTabs. Everything else here streams as part of the initial HTML. */
export function HomePageContent({ feed, trending, categories }: Props) {
  return (
    <main
      data-testid="forge-home"
      className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12"
    >
      <HomeFeedSections />
      <LiveNowRail />
      <ContinueWatching />
      <FeaturedCoursesRail />
      <TrendingRail videos={trending.data.length > 0 ? trending.data : feed.data} />
      <HomeFeedTabs feed={feed} categories={categories} />
    </main>
  );
}
