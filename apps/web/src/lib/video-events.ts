export const VIDEO_READY_EVENT = 'forge:video-ready';

export type VideoReadyDetail = {
  videoId: string;
  status?: string;
  hlsUrl?: string;
  thumbnailUrl?: string;
};

export function dispatchVideoReady(detail: VideoReadyDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<VideoReadyDetail>(VIDEO_READY_EVENT, { detail }));
}
