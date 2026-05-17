import Link from 'next/link';
import { Metadata } from 'next';
import { serverApi } from '@/lib/api';
import { PageHeader } from '@forge/design-system';
import { Category } from '@/types';

export const metadata: Metadata = { title: 'Explore' };

const DISCIPLINES = [
  { slug: 'physical-crafts', name: 'Physical Crafts', icon: 'handyman' },
  { slug: 'art-design', name: 'Art & Design', icon: 'palette' },
  { slug: 'building-tech', name: 'Building & Tech', icon: 'construction' },
  { slug: 'fitness', name: 'Fitness & Transformation', icon: 'fitness_center' },
  { slug: 'learning-journeys', name: 'Learning Journeys', icon: 'school' },
  { slug: 'music', name: 'Music & Practice', icon: 'music_note' },
];

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
    <main className="mx-auto max-w-[var(--spacing-container-max)] px-5 py-8 md:px-12">
      <PageHeader title="Explore" subtitle="Discover skills and learning paths by discipline" />

      {categories.length > 0 && (
        <section className="mb-12">
          <h2 className="font-label-caps mb-4 text-outline">Platform categories</h2>
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
        </section>
      )}

      <section className="mb-12">
        <h2 className="font-label-caps mb-4 text-outline">Core disciplines</h2>
        <div className="forge-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DISCIPLINES.map((d) => (
            <Link
              key={d.slug}
              href={`/explore/${d.slug}`}
              className="forge-card-hover glass-panel group rounded-xl p-6 transition-colors hover:border-primary/40"
            >
              <span className="material-symbols-outlined mb-3 text-3xl text-primary">{d.icon}</span>
              <h3 className="font-display-forge text-lg font-semibold group-hover:text-primary">{d.name}</h3>
            </Link>
          ))}
        </div>
      </section>

    </main>
  );
}
