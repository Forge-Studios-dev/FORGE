'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, Eye, BookmarkPlus } from 'lucide-react';
import { Video } from '@/types';
import { api } from '@/lib/api';
import { formatCount, timeAgo } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface Props {
  video: Video;
}

export function VideoInfo({ video }: Props) {
  const qc = useQueryClient();
  const router = useRouter();

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/videos/${video.id}/like`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['video', video.id] }),
  });

  const saveToPlaylist = useMutation({
    mutationFn: async () => {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('forge_user') : null;
      if (!stored) throw new Error('Please sign in to use playlists');
      router.push(`/playlists/new?videoId=${video.id}`);
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{video.title}</h1>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <Link href={`/${video.user.username}`} className="flex items-center gap-3 hover:opacity-80 transition">
          {video.user.avatarUrl ? (
            <Image src={video.user.avatarUrl} alt={video.user.displayName} width={40} height={40} className="rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-forge-600 flex items-center justify-center text-white font-bold">
              {video.user.displayName[0]}
            </div>
          )}
          <div>
            <p className="font-semibold text-sm">{video.user.displayName}</p>
            <p className="text-xs text-gray-400">{formatCount(video.user.followerCount)} followers</p>
          </div>
        </Link>

        <div className="flex items-center gap-6 text-sm text-gray-400">
          <span className="flex items-center gap-1.5">
            <Eye size={16} />
            {formatCount(video.viewCount)}
          </span>
          <button
            onClick={() => likeMutation.mutate()}
            className="flex items-center gap-1.5 hover:text-red-400 transition"
          >
            <Heart size={16} />
            {formatCount(video.likeCount)}
          </button>
          <button
            onClick={() => saveToPlaylist.mutate()}
            className="flex items-center gap-1.5 hover:text-forge-400 transition"
          >
            <BookmarkPlus size={16} />
            Save
          </button>
          <span className="flex items-center gap-1.5">
            <MessageCircle size={16} />
            {formatCount(video.commentCount)}
          </span>
          <span>{timeAgo(video.createdAt)}</span>
        </div>
      </div>

      {video.description && (
        <div className="glass rounded-xl p-4">
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{video.description}</p>
        </div>
      )}

      {video.skillTags?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {video.skillTags.map((tag) => (
            <span key={tag.id} className="px-3 py-1 bg-forge-500/10 border border-forge-500/20 text-forge-400 text-xs rounded-full">
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
