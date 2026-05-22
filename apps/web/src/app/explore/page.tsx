import Link from 'next/link';
import { Metadata } from 'next';
import { serverApi } from '@/lib/api';
import { PageHeader } from '@forge/design-system';
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
      <PageHeader title="Explore" subtitle="Discover skills and learning paths by discipline" />

      <section className="mb-12">
        <h2 className="font-label-caps mb-4 text-outline">Browse by category</h2>
        {categories.length > 0 ? (
          <div className="forge-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/explore/${cat.slug}`}
                className="forge-card-hover glass-panel group rounded-xl p-6 transition-colors hover:border-primary/40"
              >
                <span className="material-symbols-outlined mb-3 text-3xl text-primary">category</span>
                <h3 className="font-display-forge text-lg font-semibold group-hover:text-primary">{cat.name}</h3>
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
