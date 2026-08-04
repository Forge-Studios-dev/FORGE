import { redirectToCommunityCanonical } from '@/lib/redirect-to-community';

export const dynamic = 'force-dynamic';

interface Props {
  params: { communityId: string };
}

/** Legacy `/community/:id` deep link → canonical `/{username}/c/{slug}`. */
export default async function CommunityRootRedirectPage({ params }: Props) {
  await redirectToCommunityCanonical(params.communityId);
}
