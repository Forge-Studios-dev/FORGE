import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/api';
import { Video } from '@/types';
import { VideoPlayer } from '@/components/VideoPlayer/VideoPlayer';
import { VideoInfo } from '@/components/VideoPlayer/VideoInfo';
import { CommentsPanel } from '@/components/Comments/CommentsPanel';

interface Props {
  params: { id: string };
}

async function getVideo(id: string): Promise<Video | null> {
  try {
    const { data } = await serverApi.get(`/videos/${id}`);
    return data.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const video = await getVideo(params.id);
  if (!video) return { title: 'Video not found' };

  return {
    title: video.title,
    description: video.description || `Watch ${video.title} on FORGE`,
    openGraph: {
      title: video.title,
      description: video.description,
      images: video.thumbnailUrl ? [{ url: video.thumbnailUrl }] : [],
      type: 'video.other',
    },
    twitter: {
      card: 'summary_large_image',
      title: video.title,
      description: video.description,
      images: video.thumbnailUrl ? [video.thumbnailUrl] : [],
    },
  };
}

export default async function WatchPage({ params }: Props) {
  const video = await getVideo(params.id);
  if (!video) notFound();

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <VideoPlayer hlsUrl={video.hlsUrl} thumbnailUrl={video.thumbnailUrl} title={video.title} />
            <VideoInfo video={video} />
            <CommentsPanel videoId={video.id} />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">More from {video.user.displayName}</h3>
            <p className="text-sm text-gray-400">Related videos coming soon.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
