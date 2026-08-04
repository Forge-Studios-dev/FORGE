import { notFound } from 'next/navigation';
import { getUserByUsernameCached } from '@/lib/get-user-by-username';
import { UserListPage } from '@/components/profile/UserListPage';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

/** Channel subscriptions list (channels this user is subscribed to). */
export default async function ChannelSubscriptionsPage({ params }: Props) {
  const user = await getUserByUsernameCached(params.username);
  if (!user) notFound();
  return <UserListPage userId={user.id} type="following" username={user.username} />;
}
