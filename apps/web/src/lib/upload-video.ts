import type { UploadVisibility } from '@/lib/upload-draft';
import { runBackgroundUpload, subscribeActiveUpload } from '@/lib/upload-manager';

const MAX_BYTES = 500 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/x-m4v', '']);
export const SHORT_MAX_DURATION_SECONDS = 60;
export const SHORT_TOO_LONG_MESSAGE =
  'Shorts must be 60 seconds or shorter. Upload as a regular video instead.';

export type UploadPhase = 'presigning' | 'uploading' | 'completing';

export type CompleteUploadOptions = {
  categoryId: string;
  skillTagIds: string[];
  visibility?: UploadVisibility;
  scheduledPublishAt?: string;
  playlistIds?: string[];
  videoType?: 'video' | 'short';
};

export function resolveVideoContentType(file: File): string {
  if (file.type && ALLOWED_TYPES.has(file.type)) return file.type === '' ? 'video/mp4' : file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'mov') return 'video/quicktime';
  return 'video/mp4';
}

export function validateUploadFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const typeOk =
    !file.type ||
    ALLOWED_TYPES.has(file.type) ||
    ext === 'mp4' ||
    ext === 'mov';
  if (!typeOk) return 'File must be MP4 or MOV.';
  if (file.size > MAX_BYTES) return 'File must be 500MB or smaller.';
  if (file.size < 1024) return 'File is too small to upload.';
  return null;
}

/** Probe media duration via a temporary video element. Returns null if unknown. */
export function probeVideoDurationSeconds(file: File): Promise<number | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    // Local File → blob: URL only; never assign untrusted HTML/script URLs.
    if (!url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      resolve(null);
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    const finish = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () => {
      const d = video.duration;
      finish(Number.isFinite(d) ? d : null);
    };
    video.onerror = () => finish(null);
    video.setAttribute('src', url);
  });
}

export function validateShortDuration(
  durationSeconds: number | null,
  videoType: 'video' | 'short' | undefined,
): string | null {
  if (videoType !== 'short') return null;
  if (durationSeconds === null || !Number.isFinite(durationSeconds)) return null;
  if (durationSeconds > SHORT_MAX_DURATION_SECONDS) return SHORT_TOO_LONG_MESSAGE;
  return null;
}

export async function uploadVideo(
  file: File,
  title: string,
  description: string,
  onProgress: (pct: number, phase: UploadPhase) => void,
  options: CompleteUploadOptions,
): Promise<string> {
  const unsub = subscribeActiveUpload((state) => {
    if (!state) return;
    onProgress(state.progress, state.phase);
  });

  try {
    return await runBackgroundUpload(file, title, description, options);
  } finally {
    unsub();
  }
}
