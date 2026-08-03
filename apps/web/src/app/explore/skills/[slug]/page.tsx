import { redirect } from 'next/navigation';

interface Props {
  params: { slug: string };
}

/** Legacy skill-tag URLs → search (YouTube-replica topic discovery). */
export default function ExploreSkillTagRedirect({ params }: Props) {
  const q = params.slug.replace(/-/g, ' ').trim();
  redirect(`/search?q=${encodeURIComponent(q)}`);
}
