import { notFound } from 'next/navigation';
import { UserListPage } from '@/components/profile/UserListPage';
import { ChannelUnavailable } from '@/components/profile/ChannelUnavailable';
import { lookupUserByUsernameCached } from '@/lib/get-user-by-username';
import { redirectIfStaleProfileUsername } from '@/lib/username-redirect';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

export default async function SubscriptionsPage({ params }: Props) {
  const lookup = await lookupUserByUsernameCached(params.username);
  if (lookup.status === 'unavailable') return <ChannelUnavailable />;
  if (lookup.status !== 'ok') notFound();
  const user = lookup.user;
  redirectIfStaleProfileUsername(params.username, user.username, '/subscriptions');

  return <UserListPage userId={user.id} type="following" username={user.username} />;
}
