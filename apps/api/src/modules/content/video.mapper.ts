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
  categoryId: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  scheduledPublishAt: Date | null;
};

export type PublicVideoMapperOpts = {
  rewriteMediaUrl?: (url: string | null | undefined) => string | null;
};

export function toPublicVideo(video: Video, opts?: PublicVideoMapperOpts): PublicVideo {
  const rewrite = opts?.rewriteMediaUrl ?? ((u: string | null | undefined) => u ?? null);
  return {
    id: video.id,
    userId: video.userId,
    user: video.user ? toPublicUser(video.user) : undefined,
    title: video.title,
    description: video.description,
    status: video.status,
    visibility: video.visibility,
    hlsUrl: rewrite(video.hlsUrl),
    thumbnailUrl: rewrite(video.thumbnailUrl),
    durationSeconds: video.durationSeconds,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    skillTags: video.skillTags ?? [],
    categoryId: video.categoryId ?? null,
    createdAt: video.createdAt,
    publishedAt: video.publishedAt,
    scheduledPublishAt: video.scheduledPublishAt ?? null,
  };
}

export function toPublicVideos(videos: Video[], opts?: PublicVideoMapperOpts): PublicVideo[] {
  return videos.map((v) => toPublicVideo(v, opts));
}
