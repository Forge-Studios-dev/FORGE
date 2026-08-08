import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChannelUnavailable } from '@/components/profile/ChannelUnavailable';
import { lookupUserByUsernameCached } from '@/lib/get-user-by-username';
import { redirectIfStaleProfileUsername } from '@/lib/username-redirect';
import { ProfileHeader } from '@/components/ProfileHeader/ProfileHeader';
import { CommunityPanel } from '@/components/Community/CommunityPanel';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string; communitySlug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lookup = await lookupUserByUsernameCached(params.username);
  if (lookup.status !== 'ok') return { title: 'Community' };
  return { title: `${lookup.user.displayName} — ${params.communitySlug}` };
}

export default async function CommunitySlugPage({ params }: Props) {
  const lookup = await lookupUserByUsernameCached(params.username);
  if (lookup.status === 'unavailable') return <ChannelUnavailable />;
  if (lookup.status !== 'ok') notFound();
  const user = lookup.user;
  redirectIfStaleProfileUsername(
    params.username,
    user.username,
    `/c/${params.communitySlug}`,
  );

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
