import { Stream, StreamChatMode, StreamEndReason, StreamStatus, StreamVisibility } from './entities/stream.entity';
import { toPublicUser, PublicUser } from '../users/user.mapper';
import { resolveStreamThumbnailUrl } from '../../common/media/mux-playback.util';

/** Matches the default of MUX_IDLE_GRACE_SEC — used only when a caller omits opts.reconnectGraceSec. */
const FALLBACK_RECONNECT_GRACE_SEC = 60;

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
  endReason: StreamEndReason | null;
  /** True while status is LIVE but the host's ingest has gone idle within the reconnect grace period. */
  reconnecting: boolean;
  /** ISO timestamp the stream auto-ends at if the host doesn't reconnect (null unless `reconnecting`). */
  reconnectDeadline: string | null;
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
    /** Configured MUX_IDLE_GRACE_SEC — pass the real value so reconnectDeadline isn't a client-side guess. */
    reconnectGraceSec?: number;
  },
): PublicStream {
  const hidePlayback = opts?.hidePlayback ?? false;
  const canPlay = !hidePlayback && stream.status === StreamStatus.LIVE;
  const playbackUrl = canPlay ? (opts?.playbackUrl ?? stream.playbackUrl ?? null) : null;
  const reconnecting = stream.status === StreamStatus.LIVE && !!stream.muxIdleSince;
  const reconnectDeadline = reconnecting
    ? new Date(
        stream.muxIdleSince!.getTime() +
          (opts?.reconnectGraceSec ?? FALLBACK_RECONNECT_GRACE_SEC) * 1000,
      ).toISOString()
    : null;
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
    endReason: stream.endReason ?? null,
    reconnecting,
    reconnectDeadline,
    createdAt: stream.createdAt,
    streamKey: includeIngest ? stream.streamKey : null,
    rtmpUrl: includeIngest ? stream.rtmpUrl : null,
    accessDenied: hidePlayback,
    accessReason: opts?.accessReason,
  };
}

/** JSON payload for stream detail Redis cache. */
export function serializeStreamForCache(stream: Stream): string {
  return JSON.stringify(stream);
}
