import { Stream, StreamChatMode, StreamStatus, StreamVisibility } from './entities/stream.entity';
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
  chatMode: StreamChatMode;
  recordEnabled: boolean;
  ageRestricted: boolean;
  requiredTierId: string | null;
  slowModeSeconds: number;
  scheduledAt: Date | null;
  ticketPriceCents: number | null;
  pinnedMessageId: string | null;
  viewerCount: number;
  uniqueViewerCount: number;
  dvrEnabled: boolean;
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
  opts?: {
    hidePlayback?: boolean;
    accessReason?: string;
    scheduledAt?: Date | null;
    ticketPriceCents?: number | null;
    pinnedMessageId?: string | null;
    playbackUrl?: string | null;
  },
): PublicStream {
  const hidePlayback = opts?.hidePlayback ?? false;
  const canPlay = !hidePlayback && stream.status === StreamStatus.LIVE;
  const playbackUrl = canPlay ? (opts?.playbackUrl ?? stream.playbackUrl ?? null) : null;
  return {
    id: stream.id,
    userId: stream.userId,
    user: stream.user ? toPublicUser(stream.user) : undefined,
    title: stream.title,
    description: stream.description ?? null,
    playbackUrl,
    thumbnailUrl: resolveStreamThumbnailUrl(stream),
    status: stream.status,
    visibility: stream.visibility ?? StreamVisibility.PUBLIC,
    categoryId: stream.categoryId ?? null,
    chatEnabled: stream.chatEnabled ?? true,
    chatMode: stream.chatMode ?? StreamChatMode.ALL,
    recordEnabled: stream.recordEnabled ?? true,
    ageRestricted: stream.ageRestricted ?? false,
    requiredTierId: stream.requiredTierId ?? null,
    slowModeSeconds: stream.slowModeSeconds ?? 0,
    scheduledAt: opts?.scheduledAt ?? stream.scheduledAt ?? null,
    ticketPriceCents: opts?.ticketPriceCents ?? stream.ticketPriceCents ?? null,
    pinnedMessageId: opts?.pinnedMessageId ?? stream.pinnedMessageId ?? null,
    viewerCount: stream.viewerCount,
    uniqueViewerCount: stream.uniqueViewerCount ?? 0,
    dvrEnabled: stream.dvrEnabled ?? false,
    startedAt: stream.startedAt ?? null,
    endedAt: stream.endedAt ?? null,
    createdAt: stream.createdAt,
    streamKey: includeIngest ? stream.streamKey : null,
    rtmpUrl: includeIngest ? stream.rtmpUrl : null,
    accessDenied: hidePlayback,
    accessReason: opts?.accessReason,
  };
}
