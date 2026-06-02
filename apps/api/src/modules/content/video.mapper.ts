import { Video, ModerationStatus, VideoStatus } from './entities/video.entity';
import { toPublicUser, PublicUser } from '../users/user.mapper';
import { sanitizeHlsUrl, sanitizeThumbnailUrl } from '../../common/media/playback-url.util';

/** Coerce Postgres bigint / JS BigInt to a JSON-safe number (or null). */
export function jsonSafeIntField(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

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

function publicPlaybackUrls(video: Video): {
  hlsUrl: string | null;
  thumbnailUrl: string | null;
} {
  if (video.status !== VideoStatus.READY) {
    return { hlsUrl: null, thumbnailUrl: null };
  }
  return {
    hlsUrl: sanitizeHlsUrl(video.hlsUrl),
    thumbnailUrl: sanitizeThumbnailUrl(video.thumbnailUrl),
  };
}

export function toPublicVideo(video: Video, opts?: PublicVideoMapperOpts): PublicVideo {
  const rewrite = opts?.rewriteMediaUrl ?? ((u: string | null | undefined) => u ?? null);
  const playback = publicPlaybackUrls(video);
  return {
    id: video.id,
    userId: video.userId,
    user: video.user ? toPublicUser(video.user) : undefined,
    title: video.title,
    description: video.description,
    status: video.status,
    visibility: video.visibility,
    hlsUrl: rewrite(playback.hlsUrl),
    thumbnailUrl: rewrite(playback.thumbnailUrl),
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

export type AdminVideoCreator = {
  id: string;
  displayName: string;
  username: string;
};

export type AdminVideo = {
  id: string;
  userId: string;
  user?: AdminVideoCreator;
  title: string;
  description: string | null;
  status: Video['status'];
  visibility: Video['visibility'];
  moderationStatus: ModerationStatus;
  moderationNote: string | null;
  moderatedAt: Date | null;
  moderatedBy: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  uploadFileSizeBytes: number | null;
  fileSizeBytes: number | null;
  hlsUrl: string | null;
  thumbnailUrl: string | null;
  scheduledPublishAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toAdminVideo(video: Video): AdminVideo {
  return {
    id: video.id,
    userId: video.userId,
    user: video.user
      ? {
          id: video.user.id,
          displayName: video.user.displayName,
          username: video.user.username,
        }
      : undefined,
    title: video.title,
    description: video.description,
    status: video.status,
    visibility: video.visibility,
    moderationStatus: video.moderationStatus,
    moderationNote: video.moderationNote,
    moderatedAt: video.moderatedAt,
    moderatedBy: video.moderatedBy,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    uploadFileSizeBytes: jsonSafeIntField(video.uploadFileSizeBytes),
    fileSizeBytes: jsonSafeIntField(video.fileSizeBytes),
    hlsUrl: video.hlsUrl,
    thumbnailUrl: video.thumbnailUrl,
    scheduledPublishAt: video.scheduledPublishAt,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
  };
}

export function toAdminVideos(videos: Video[]): AdminVideo[] {
  return videos.map(toAdminVideo);
}

/** JSON payload for video detail Redis cache (avoids BigInt serialization errors). */
export function serializeVideoForCache(video: Video): string {
  return JSON.stringify({
    ...video,
    uploadFileSizeBytes: jsonSafeIntField(video.uploadFileSizeBytes),
    fileSizeBytes: jsonSafeIntField(video.fileSizeBytes),
  });
}
