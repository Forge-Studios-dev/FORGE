import { Video } from './entities/video.entity';
import { toPublicUser, PublicUser } from '../users/user.mapper';

export type PublicVideo = {
  id: string;
  userId: string;
  user?: PublicUser;
  title: string;
  description: string | null;
  status: Video['status'];
  visibility: Video['visibility'];
  hlsUrl: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  skillTags: Video['skillTags'];
  createdAt: Date;
  publishedAt: Date | null;
};

export function toPublicVideo(video: Video): PublicVideo {
  return {
    id: video.id,
    userId: video.userId,
    user: video.user ? toPublicUser(video.user) : undefined,
    title: video.title,
    description: video.description,
    status: video.status,
    visibility: video.visibility,
    hlsUrl: video.hlsUrl,
    thumbnailUrl: video.thumbnailUrl,
    durationSeconds: video.durationSeconds,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    skillTags: video.skillTags ?? [],
    createdAt: video.createdAt,
    publishedAt: video.publishedAt,
  };
}

export function toPublicVideos(videos: Video[]): PublicVideo[] {
  return videos.map(toPublicVideo);
}
