import { redirect, notFound } from 'next/navigation';
import { serverApi } from '@/lib/api';
import { User } from '@/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const { data } = await serverApi.get(`/users/by-username/${username}`);
    return data.data;
  } catch {
    return null;
  }
}

export default async function CommunityRedirectPage({ params }: Props) {
  const user = await getUserByUsername(params.username);
  if (!user) notFound();

  try {
    const { data } = await serverApi.get<{ data: Array<{ slug: string }> }>(
      `/creators/${user.id}/communities`,
    );
    const list = data.data ?? [];
    const slug = list[0]?.slug ?? 'community';
    redirect(`/${params.username}/c/${slug}`);
  } catch {
    redirect(`/${params.username}/c/community`);
  }
}
