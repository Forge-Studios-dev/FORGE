import {
  ModerationStatus,
  PublishStatus,
  Video,
  VideoStatus,
  VideoVisibility,
} from './entities/video.entity';

/** Ready to index for discovery (excludes indexedAt — used when setting indexedAt). */
export function shouldIndexVideo(video: Video, now = new Date()): boolean {
  if (video.status !== VideoStatus.READY) return false;
  if (video.publishStatus !== PublishStatus.PUBLISHED) return false;
  if (video.visibility !== VideoVisibility.PUBLIC) return false;
  if (video.moderationStatus !== ModerationStatus.NONE) return false;
  if (video.scheduledPublishAt && video.scheduledPublishAt > now) return false;
  if (video.publishedAt && video.publishedAt > now) return false;
  return true;
}

/** Videos eligible for home feed, explore, search, and recommendations. */
export function isVideoDiscoverable(video: Video, now = new Date()): boolean {
  if (!shouldIndexVideo(video, now)) return false;
  if (!video.indexedAt) return false;
  return true;
}

/** Set when transcoding finishes and the video is ready for consumers. */
export function publishStatusOnReady(): PublishStatus {
  return PublishStatus.PUBLISHED;
}

export function indexedAtOnReady(video: Video, now = new Date()): Date | null {
  if (
    !shouldIndexVideo(
      { ...video, status: VideoStatus.READY, publishStatus: PublishStatus.PUBLISHED },
      now,
    )
  ) {
    return null;
  }
  return now;
}
