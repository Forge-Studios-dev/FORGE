import { Stream } from './entities/stream.entity';
import { toPublicUser, PublicUser } from '../users/user.mapper';

export type PublicStream = {
  id: string;
  userId: string;
  user?: PublicUser;
  title: string;
  description: string | null;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
  status: Stream['status'];
  viewerCount: number;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  streamKey?: string | null;
  rtmpUrl?: string | null;
};

export function toPublicStream(stream: Stream, includeIngest = false): PublicStream {
  return {
    id: stream.id,
    userId: stream.userId,
    user: stream.user ? toPublicUser(stream.user) : undefined,
    title: stream.title,
    description: stream.description ?? null,
    playbackUrl: stream.playbackUrl ?? null,
    thumbnailUrl: stream.thumbnailUrl ?? null,
    status: stream.status,
    viewerCount: stream.viewerCount,
    startedAt: stream.startedAt ?? null,
    endedAt: stream.endedAt ?? null,
    createdAt: stream.createdAt,
    streamKey: includeIngest ? stream.streamKey : null,
    rtmpUrl: includeIngest ? stream.rtmpUrl : null,
  };
}
