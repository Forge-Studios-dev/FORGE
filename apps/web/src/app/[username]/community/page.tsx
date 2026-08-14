import { redirect, notFound } from 'next/navigation';
import { serverApi } from '@/lib/api';
import { ChannelUnavailable } from '@/components/profile/ChannelUnavailable';
import { lookupUserByUsernameCached } from '@/lib/get-user-by-username';
import { redirectIfStaleProfileUsername } from '@/lib/username-redirect';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

export default async function CommunityRedirectPage({ params }: Props) {
  const lookup = await lookupUserByUsernameCached(params.username);
  if (lookup.status === 'unavailable') return <ChannelUnavailable />;
  if (lookup.status !== 'ok') notFound();
  const user = lookup.user;
  redirectIfStaleProfileUsername(params.username, user.username, '/community');

  try {
    const { data } = await serverApi.get<{ data: Array<{ slug: string }> }>(
      `/creators/${user.id}/communities`,
    );
    const list = data.data ?? [];
    const slug = list[0]?.slug ?? 'community';
    redirect(`/${user.username}/c/${slug}`);
  } catch {
    redirect(`/${user.username}/c/community`);
  }
}
