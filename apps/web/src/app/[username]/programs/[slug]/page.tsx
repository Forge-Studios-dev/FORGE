import Link from 'next/link';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@forge/design-system';
import { serverApi } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import { getUserByUsernameCached } from '@/lib/get-user-by-username';
import { getServerPlatformConfig } from '@/lib/server-platform-config';
import { ProgramViewerClient, type PublicProgram } from '@/components/Courses/ProgramViewerClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string; slug: string };
  searchParams?: { purchased?: string };
}

async function getProgram(creatorId: string, slug: string): Promise<PublicProgram | null> {
  try {
    const { data } = await serverApi.get<{ data: PublicProgram }>(
      `/creators/${creatorId}/programs/${slug}`,
    );
    return data.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await getUserByUsernameCached(params.username);
  if (!user) return { title: 'Program not found' };
  const program = await getProgram(user.id, params.slug);
  if (!program) return { title: 'Program not found' };
  return {
    title: `${program.name} · @${user.username}`,
    description: program.description ?? `A multi-course program by ${user.displayName}`,
    openGraph: {
      title: program.name,
      url: `${SITE_URL}/${user.username}/programs/${program.slug}`,
      type: 'website',
    },
  };
}

export default async function ProgramPage({ params, searchParams }: Props) {
  const platformConfig = await getServerPlatformConfig();
  if (!platformConfig.skillFeatures?.skillEconomyLms) {
    redirect(`/${params.username}`);
  }

  const user = await getUserByUsernameCached(params.username);
  if (!user) notFound();

  const program = await getProgram(user.id, params.slug);
  if (!program) notFound();

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-12">
      <Link href={`/${user.username}`} className="mb-4 inline-block text-sm text-primary">
        ← {user.displayName}
      </Link>
      <PageHeader
        title={program.name}
        subtitle={`Program · ${program.courses.length} course${program.courses.length === 1 ? '' : 's'}`}
      />
      <ProgramViewerClient
        program={program}
        creatorUsername={user.username}
        justPurchased={searchParams?.purchased === '1'}
      />
    </main>
  );
}
