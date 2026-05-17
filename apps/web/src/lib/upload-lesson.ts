import { api } from '@/lib/api';

const MAX_BYTES = 500 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['video/mp4', 'video/quicktime']);

export function validateUploadFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) return 'File must be MP4 or MOV.';
  if (file.size > MAX_BYTES) return 'File must be 500MB or smaller.';
  return null;
}

export async function uploadLesson(
  file: File,
  title: string,
  description: string,
  onProgress: (pct: number) => void,
  skillTagName?: string,
): Promise<string> {
  const presignRes = await api.post('/videos/presigned-url', {
    contentType: file.type,
    fileSizeBytes: file.size,
  });
  const { videoId, uploadUrl } = presignRes.data.data as { videoId: string; uploadUrl: string };

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) onProgress(Math.round((evt.loaded / evt.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(file);
  });

  await api.post(`/videos/${videoId}/complete`, {
    title: title.trim(),
    description: description.trim() || undefined,
    skillTagName: skillTagName?.trim() || undefined,
  });

  return videoId;
}
