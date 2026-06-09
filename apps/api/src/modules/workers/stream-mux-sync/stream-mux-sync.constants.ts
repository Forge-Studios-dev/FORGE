export const STREAM_MUX_SYNC_QUEUE = 'stream-mux-sync';

export type StreamMuxSyncJob = {
  /** When set, sync a single stream; otherwise run periodic scan. */
  streamId?: string;
};
