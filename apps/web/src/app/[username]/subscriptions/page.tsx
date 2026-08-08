import { notFound } from 'next/navigation';
import { UserListPage } from '@/components/profile/UserListPage';
import { getUserByUsernameCached } from '@/lib/get-user-by-username';
import { redirectIfStaleProfileUsername } from '@/lib/username-redirect';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

export default async function SubscriptionsPage({ params }: Props) {
  const user = await getUserByUsernameCached(params.username);
  if (!user) notFound();
  redirectIfStaleProfileUsername(params.username, user.username, '/subscriptions');

  return <UserListPage userId={user.id} type="following" username={user.username} />;
}
