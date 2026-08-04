import { redirectToCommunityCanonical } from '@/lib/redirect-to-community';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

/** Legacy discover fallback → canonical `/{username}/c/{slug}`. */
export default async function CommunityIdRedirectPage({ params }: Props) {
  await redirectToCommunityCanonical(params.id);
}
