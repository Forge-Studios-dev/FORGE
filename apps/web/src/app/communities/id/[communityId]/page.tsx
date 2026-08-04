import { notFound, redirect } from 'next/navigation';
import { serverApi } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface Props {
  params: { communityId: string };
}

type CommunityByIdResponse = {
  data: {
    community?: {
      id: string;
      slug?: string | null;
      creatorId?: string | null;
    } | null;
  };
};

type CreatorLookupResponse = {
  data: {
    username?: string | null;
  };
};

export default async function CommunityIdRedirectPage({ params }: Props) {
  try {
    const { data } = await serverApi.get<CommunityByIdResponse>(
      `/communities/id/${params.communityId}`,
    );
    const community = data.data?.community;
    if (!community?.slug || !community.creatorId) notFound();

    const creator = await serverApi.get<CreatorLookupResponse>(
      `/users/${community.creatorId}`,
    );
    const username = creator.data.data?.username;
    if (!username) notFound();

    redirect(`/${username}/c/${community.slug}`);
  } catch {
    notFound();
  }
}
