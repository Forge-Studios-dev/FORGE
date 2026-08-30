export const STREAM_CLIP_EXPORT_QUEUE = 'stream-clip-export';

export type StreamClipExportJob = {
  clipId: string;
};

/** Mux asset passthrough prefix so video.asset.ready can finish clip rows. */
export const STREAM_CLIP_PASSTHROUGH_PREFIX = 'forge-clip:';
