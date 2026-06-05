export const MUX_VOD_INGEST_QUEUE = 'mux-vod-ingest';

/** Stable BullMQ job id — duplicate webhook/enqueue must not create parallel ingest jobs (F-1001). */
export function muxVodIngestJobId(videoId: string): string {
  return `mux-ingest-${videoId}`;
}

export {
  muxHlsPlaybackUrl,
  muxThumbnailUrl,
} from '../../common/media/mux-playback.util';
