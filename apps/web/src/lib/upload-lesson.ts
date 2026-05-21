import { api } from '@/lib/api';
import type { UploadVisibility } from '@/lib/upload-draft';

const MAX_BYTES = 500 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/x-m4v', '']);

export type UploadPhase = 'presigning' | 'uploading' | 'completing';

export type CompleteUploadOptions = {
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
  skillTagName?: string,
  options?: CompleteUploadOptions,
): Promise<string> {
  const contentType = resolveVideoContentType(file);

  onProgress(0, 'presigning');
  const presignRes = await api.post('/videos/presigned-url', {
    contentType,
    fileSizeBytes: file.size,
  });
  const { videoId, uploadUrl } = presignRes.data.data as { videoId: string; uploadUrl: string };

  onProgress(0, 'uploading');
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        onProgress(Math.round((evt.loaded / evt.total) * 100), 'uploading');
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage upload failed (${xhr.status}). Check S3/CORS configuration.`));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading to storage.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.send(file);
  });

  onProgress(100, 'completing');
  await api.post(`/videos/${videoId}/complete`, {
    title: title.trim(),
    description: description.trim() || undefined,
    skillTagName: skillTagName?.trim() || undefined,
    visibility: options?.visibility ?? 'public',
    scheduledPublishAt: options?.scheduledPublishAt,
    playlistIds: options?.playlistIds?.length ? options.playlistIds : undefined,
  });

  return videoId;
}
