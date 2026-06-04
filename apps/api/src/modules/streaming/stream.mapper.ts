import { Stream, StreamVisibility } from './entities/stream.entity';
import { toPublicUser, PublicUser } from '../users/user.mapper';
import { resolveStreamThumbnailUrl } from '../../common/media/mux-playback.util';

export type PublicStream = {
  id: string;
  userId: string;
  user?: PublicUser;
  title: string;
  description: string | null;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
  status: Stream['status'];
  visibility: StreamVisibility;
  categoryId: string | null;
  chatEnabled: boolean;
  recordEnabled: boolean;
  ageRestricted: boolean;
  requiredTierId: string | null;
  slowModeSeconds: number;
  viewerCount: number;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  streamKey?: string | null;
  rtmpUrl?: string | null;
  accessDenied?: boolean;
  accessReason?: string;
};

export function toPublicStream(
  stream: Stream,
  includeIngest = false,
  opts?: { hidePlayback?: boolean; accessReason?: string },
): PublicStream {
  const hidePlayback = opts?.hidePlayback ?? false;
  return {
    id: stream.id,
    userId: stream.userId,
    user: stream.user ? toPublicUser(stream.user) : undefined,
    title: stream.title,
    description: stream.description ?? null,
    playbackUrl: hidePlayback ? null : (stream.playbackUrl ?? null),
    thumbnailUrl: resolveStreamThumbnailUrl(stream),
    status: stream.status,
    visibility: stream.visibility ?? StreamVisibility.PUBLIC,
    categoryId: stream.categoryId ?? null,
    chatEnabled: stream.chatEnabled ?? true,
    recordEnabled: stream.recordEnabled ?? true,
    ageRestricted: stream.ageRestricted ?? false,
    requiredTierId: stream.requiredTierId ?? null,
    slowModeSeconds: stream.slowModeSeconds ?? 0,
    viewerCount: stream.viewerCount,
    startedAt: stream.startedAt ?? null,
    endedAt: stream.endedAt ?? null,
    createdAt: stream.createdAt,
    streamKey: includeIngest ? stream.streamKey : null,
    rtmpUrl: includeIngest ? stream.rtmpUrl : null,
    accessDenied: hidePlayback,
    accessReason: opts?.accessReason,
  };
}
