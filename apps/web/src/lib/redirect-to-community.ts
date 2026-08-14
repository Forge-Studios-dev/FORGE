import { notFound, redirect } from 'next/navigation';
import { serverApi } from '@/lib/api';

type CommunityByIdResponse = {
  data: {
    community: {
      id: string;
      slug: string;
      creatorId: string;
    };
  };
};

type UserResponse = {
  data: {
    id: string;
    username: string;
  };
};

function isNextControlFlowError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'digest' in err &&
    typeof (err as { digest: unknown }).digest === 'string' &&
    String((err as { digest: string }).digest).startsWith('NEXT_')
  );
}

/**
 * Resolve a community UUID to the canonical public URL `/{username}/c/{slug}`.
 * Used by thin App Router redirect pages for legacy `/community/:id` and
 * `/communities/id/:id` deep links.
 */
export async function redirectToCommunityCanonical(communityId: string): Promise<never> {
  try {
    const { data } = await serverApi.get<CommunityByIdResponse>(`/communities/id/${communityId}`);
    const community = data.data?.community;
    if (!community?.creatorId || !community.slug) notFound();

    const { data: userRes } = await serverApi.get<UserResponse>(`/users/${community.creatorId}`);
    const username = userRes.data?.username;
    if (!username) notFound();

    redirect(`/${username}/c/${community.slug}`);
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    notFound();
  }
}
