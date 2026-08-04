import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

/** Legacy Twitter-era path → YouTube-style subscriptions. */
export default function FollowingRedirectPage({ params }: Props) {
  redirect(`/${params.username}/subscriptions`);
}
