import Image from 'next/image';
import Link from 'next/link';
import { Video } from '@/types';
import { formatCount, formatDuration, timeAgo } from '@/lib/utils';

interface Props {
  video: Video;
}

export function FeedCard({ video }: Props) {
  return (
    <Link href={`/watch/${video.id}`} className="group block bg-surface-card rounded-xl overflow-hidden hover:ring-1 hover:ring-white/10 transition-all">
      <div className="relative aspect-video overflow-hidden">
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt={video.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full bg-surface-secondary flex items-center justify-center">
            <span className="text-4xl">🎬</span>
          </div>
        )}
        {video.durationSeconds && (
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
            {formatDuration(video.durationSeconds)}
          </span>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-medium text-sm line-clamp-2 text-white group-hover:text-forge-400 transition-colors">
          {video.title}
        </h3>
        <div className="flex items-center gap-2 mt-2">
          {video.user.avatarUrl ? (
            <Image
              src={video.user.avatarUrl}
              alt={video.user.displayName}
              width={20}
              height={20}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-forge-600 flex items-center justify-center text-xs text-white font-bold shrink-0">
              {video.user.displayName[0]}
            </div>
          )}
          <Link
            href={`/${video.user.username}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-gray-400 hover:text-white transition truncate"
          >
            {video.user.displayName}
          </Link>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
          <span>{formatCount(video.viewCount)} views</span>
          <span>·</span>
          <span>{timeAgo(video.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
