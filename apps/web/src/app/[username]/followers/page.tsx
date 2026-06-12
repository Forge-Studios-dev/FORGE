import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/api';
import { User } from '@/types';
import { UserListPage } from '@/components/profile/UserListPage';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

async function getUser(username: string): Promise<User | null> {
  try {
    const { data } = await serverApi.get(`/users/by-username/${username}`);
    return data.data;
  } catch {
    return null;
  }
}

export default async function FollowersPage({ params }: Props) {
  const user = await getUser(params.username);
  if (!user) notFound();
  return <UserListPage userId={user.id} type="followers" username={user.username} />;
}
