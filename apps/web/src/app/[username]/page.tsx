import { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { serverApi } from '@/lib/api';
import { User, PaginatedResponse, Video } from '@/types';
import { ProfileHeader } from '@/components/ProfileHeader/ProfileHeader';
import { MembershipPanel } from '@/components/Membership/MembershipPanel';
import { CreatorCoursesPanel } from '@/components/Courses/CreatorCoursesPanel';
import { FeedGrid } from '@/components/FeedCard/FeedGrid';

interface Props {
  params: { username: string };
}

async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const { data } = await serverApi.get(`/users/by-username/${username}`);
    return data.data;
  } catch {
    return null;
  }
}

async function getUserVideos(userId: string): Promise<PaginatedResponse<Video>> {
  try {
    const { data } = await serverApi.get(`/users/${userId}/videos?limit=12`);
    return data.data;
  } catch {
    return { data: [], meta: { cursor: null, hasMore: false } };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await getUserByUsername(params.username);
  if (!user) return { title: 'User not found' };

  return {
    title: `${user.displayName} (@${user.username})`,
    description: user.bio || `${user.displayName}'s profile on FORGE`,
    openGraph: {
      title: `${user.displayName} on FORGE`,
      description: user.bio,
      images: user.avatarUrl ? [{ url: user.avatarUrl }] : [],
    },
  };
}

export default async function ProfilePage({ params }: Props) {
  const user = await getUserByUsername(params.username);
  if (!user) notFound();

  const videos = await getUserVideos(user.id);

  return (
    <main className="min-h-screen">
      <ProfileHeader user={user} />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <MembershipPanel creatorId={user.id} />
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <CreatorCoursesPanel creatorId={user.id} username={user.username} />
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-xl font-bold mb-6">Videos</h2>
        {videos.data.length > 0 ? (
          <FeedGrid initialData={videos} />
        ) : (
          <p className="text-gray-400">No videos yet.</p>
        )}
      </section>
    </main>
  );
}
