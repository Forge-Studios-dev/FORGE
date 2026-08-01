import { redirect, notFound } from 'next/navigation';
import { serverApi } from '@/lib/api';
import { getUserByUsernameCached } from '@/lib/get-user-by-username';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

export default async function CommunityRedirectPage({ params }: Props) {
  const user = await getUserByUsernameCached(params.username);
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
