import type { UploadVisibility } from '@/lib/upload-draft';
import { runBackgroundUpload, subscribeActiveUpload } from '@/lib/upload-manager';

const MAX_BYTES = 500 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/x-m4v', '']);

export type UploadPhase = 'presigning' | 'uploading' | 'completing';

export type CompleteUploadOptions = {
  categoryId: string;
  skillTagIds: string[];
  visibility?: UploadVisibility;
  scheduledPublishAt?: string;
  playlistIds?: string[];
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

export async function uploadLesson(
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
