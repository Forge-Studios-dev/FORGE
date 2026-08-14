'use client';

import { useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { FeedGrid } from '@/components/FeedCard/FeedGrid';
import { FeedGridSkeleton } from '@forge/design-system';
import { CategoryFilter } from '@/components/CategoryFilter';
import { NewFromFollowing } from '@/components/home/NewFromFollowing';
import { VerifyEmailBanner } from '@/components/VerifyEmailBanner';
import { Category, PaginatedResponse, Video } from '@/types';
import { useAuth } from '@/lib/auth';

type Props = {
  feed: PaginatedResponse<Video>;
  categories: Category[];
};

type FeedTab = 'forYou' | 'following';

function CategoryFilterSkeleton() {
  return (
    <div className="mb-8 flex gap-3 overflow-x-auto pb-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-9 w-28 shrink-0 forge-shimmer rounded-full" />
      ))}
    </div>
  );
}

function FeedSkeleton() {
  return <FeedGridSkeleton count={8} />;
}

/** Client island: the only interactive part of the homepage — For you / Subscriptions
 * tab state, and everything whose content depends on it. Everything else on
 * the homepage is server-rendered by HomePageContent. */
export function HomeFeedTabs({ feed, categories }: Props) {
  const { canViewPersonalizedFeed } = useAuth();
  const [tab, setTab] = useState<FeedTab>('forYou');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabs: { id: FeedTab; label: string }[] = canViewPersonalizedFeed
    ? [
        { id: 'forYou', label: 'For you' },
        { id: 'following', label: 'Subscriptions' },
      ]
    : [{ id: 'forYou', label: 'For you' }];

  function focusTab(index: number) {
    const next = tabs[(index + tabs.length) % tabs.length];
    tabRefs.current[next.id]?.focus();
    setTab(next.id);
  }

  return (
    <>
      <NewFromFollowing
        onViewAll={() => {
          setTab('following');
          document.getElementById('for-you')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      <section id="for-you" data-testid="discover-section" className="mt-4">
        <VerifyEmailBanner />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div
            className="flex gap-2"
            role="tablist"
            aria-label="Home feed"
            aria-orientation="horizontal"
          >
            {tabs.map((t, i) => {
              const selected = tab === t.id;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[t.id] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      focusTab(i + 1);
                    }
                    if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      focusTab(i - 1);
                    }
                    if (e.key === 'Home') {
                      e.preventDefault();
                      focusTab(0);
                    }
                    if (e.key === 'End') {
                      e.preventDefault();
                      focusTab(tabs.length - 1);
                    }
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    selected
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {tab === 'forYou' && (
            <Link href="/search" className="font-label-caps text-secondary hover:underline">
              Search
            </Link>
          )}
        </div>

        {tab === 'forYou' ? (
          <>
            <Suspense fallback={<CategoryFilterSkeleton />}>
              <CategoryFilter categories={categories} />
            </Suspense>
            <Suspense fallback={<FeedSkeleton />}>
              <FeedGrid initialData={feed} />
            </Suspense>
          </>
        ) : (
          <Suspense fallback={<FeedSkeleton />}>
            <FeedGrid
              initialData={{ data: [], meta: { cursor: null, hasMore: false } }}
              feedPath="/videos/feed/following"
            />
          </Suspense>
        )}
      </section>
    </>
  );
}
