import { notFound } from 'next/navigation';
import { UserListPage } from '@/components/profile/UserListPage';
import { getUserByUsernameCached } from '@/lib/get-user-by-username';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

export default async function SubscribersPage({ params }: Props) {
  const user = await getUserByUsernameCached(params.username);
  if (!user) notFound();

  return <UserListPage userId={user.id} type="followers" username={params.username} />;
}
import { notFound } from 'next/navigation';
import { getUserByUsernameCached } from '@/lib/get-user-by-username';
import { UserListPage } from '@/components/profile/UserListPage';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

export default async function SubscribersPage({ params }: Props) {
  const user = await getUserByUsernameCached(params.username);
  if (!user) notFound();
  return <UserListPage userId={user.id} type="followers" username={user.username} />;
}
