import { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { serverApi } from '@/lib/api';
import { User } from '@/types';
import { ProfileHeader } from '@/components/ProfileHeader/ProfileHeader';
import { CommunityPanel } from '@/components/Community/CommunityPanel';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string; communitySlug: string };
}

async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const { data } = await serverApi.get(`/users/by-username/${username}`);
    return data.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await getUserByUsername(params.username);
  if (!user) return { title: 'Community' };
  return { title: `${user.displayName} — ${params.communitySlug}` };
}

export default async function CommunitySlugPage({ params }: Props) {
  const user = await getUserByUsername(params.username);
  if (!user) notFound();

  return (
    <main className="min-h-screen">
      <ProfileHeader user={user} />
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h2 className="mb-6 text-xl font-bold capitalize">{params.communitySlug.replace(/-/g, ' ')}</h2>
        <CommunityPanel creatorId={user.id} communitySlug={params.communitySlug} />
      </section>
    </main>
  );
}
