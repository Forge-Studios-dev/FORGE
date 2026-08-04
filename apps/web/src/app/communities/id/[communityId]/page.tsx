import { redirectToCommunityCanonical } from '@/lib/redirect-to-community';

export const dynamic = 'force-dynamic';

interface Props {
  params: { communityId: string };
}

export default async function CommunityIdRedirectPage({ params }: Props) {
  await redirectToCommunityCanonical(params.communityId);
}
