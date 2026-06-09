import { Stream } from '../../modules/streaming/entities/stream.entity';

/** Milliseconds from stream start; null if stream has not started. */
export function computeStreamOffsetMs(stream: Pick<Stream, 'startedAt'>, at = new Date()): number | null {
  if (!stream.startedAt) return null;
  return Math.max(0, at.getTime() - stream.startedAt.getTime());
}
