import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

/** Legacy Twitter-era path → YouTube-style subscribers. */
export default function FollowersRedirectPage({ params }: Props) {
  redirect(`/${params.username}/subscribers`);
}
