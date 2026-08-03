'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Icon, StatusPage } from '@forge/design-system';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Category } from '@/types';

export default function WaitingApprovalPage() {
  const { user } = useAuth();
  const name = user?.displayName ? `${user.displayName}, ` : '';

  // Turns the review-wait into something productive instead of a dead end —
  // review typically takes a while, so give the applicant somewhere to go.
  const { data: categories } = useQuery({
    queryKey: ['categories', 'waiting-approval'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Category[] }>('/categories');
      return data.data;
    },
  });

  return (
    <>
      <StatusPage
        icon="hourglass_top"
        title="Creator approval pending"
        description={`${name}your creator request is under review. You can still browse and watch videos while you wait.`}
        action={{ label: 'Go to home', href: '/' }}
        secondary={{ label: 'Switch account', href: '/login' }}
      />
      {categories?.length ? (
        <section className="mx-auto max-w-2xl px-5 pb-16 text-center">
          <h2 className="font-label-caps mb-4 text-outline">
            Explore what other creators are publishing
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {categories.slice(0, 8).map((cat) => (
              <Link
                key={cat.id}
                href={`/explore/${cat.slug}`}
                className="flex items-center gap-2 rounded-full border border-outline-variant/40 px-4 py-2 text-sm transition-colors hover:border-primary/50 hover:text-primary"
              >
                <Icon name="category" className="text-base" />
                {cat.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
