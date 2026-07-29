export const STREAM_MUX_SYNC_QUEUE = 'stream-mux-sync';

export type StreamMuxSyncJob = {
  /** When set, sync a single stream via Mux REST (on-demand). */
  streamId?: string;
  /**
   * Delayed reconnect-grace finalize after `video.live_stream.idle` webhook.
   * Event-driven — avoids polling Mux/DB every 45–90s for timeout.
   */
  finalizeStreamId?: string;
};
