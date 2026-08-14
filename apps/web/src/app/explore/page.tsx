import Link from 'next/link';
import { Metadata } from 'next';
import { serverApi } from '@/lib/api';
import { Icon, PageHeader } from '@forge/design-system';
import { Category } from '@/types';

export const metadata: Metadata = { title: 'Explore' };

export const revalidate = 300;

async function getCategories(): Promise<Category[]> {
  try {
    const { data } = await serverApi.get('/categories');
    return data.data;
  } catch {
    return [];
  }
}

export default async function ExplorePage() {
  const categories = await getCategories();

  return (
    <main
      data-testid="forge-explore"
      className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12"
    >
      <PageHeader title="Explore" subtitle="Browse categories and discover creators" />

      <div className="mb-8 flex flex-wrap gap-3">
        <Link href="/trending" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:bg-surface-container-high">
          Trending
        </Link>
        <Link href="/search" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:bg-surface-container-high">
          Search
        </Link>
        <Link href="/shorts" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:bg-surface-container-high">
          Shorts
        </Link>
        <Link href="/live" className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm hover:bg-surface-container-high">
          Live
        </Link>
      </div>

      <section className="mb-12">
        <h2 className="font-label-caps mb-4 text-on-surface-variant">Browse by category</h2>
        {categories.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/explore/${cat.slug}`}
                className="forge-card-hover group rounded-xl border border-outline-variant/30 bg-surface-container p-6 transition-colors hover:border-primary/40"
              >
                <Icon name="category" className="mb-3 text-3xl text-primary" />
                <h3 className="font-display-forge text-lg font-semibold text-on-surface group-hover:text-primary">
                  {cat.name}
                </h3>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-on-surface-variant">Categories are loading — check back shortly.</p>
        )}
      </section>

    </main>
  );
}
