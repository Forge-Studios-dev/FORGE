import { api } from '@/lib/api';
import {
  putVideoToStorageFromPresign,
  type VideoPresignResponse,
} from '@/lib/upload-storage-multipart';
import {
  getUploadThumbnail,
  resolveThumbnailContentType,
} from '@/lib/upload-thumbnail-store';
import type { CompleteUploadOptions, UploadPhase } from '@/lib/upload-video';
import { resolveVideoContentType } from '@/lib/upload-video';

const ACTIVE_KEY = 'forge_active_upload';

export type ActiveUploadMeta = {
  videoId: string;
  fileName: string;
  title: string;
  description: string;
  options: CompleteUploadOptions;
  phase: UploadPhase;
  progress: number;
  startedAt: string;
  uploadVia?: 'direct' | 'proxy' | 'multipart';
  multipart?: {
    partCount: number;
    partSize: number;
    completedParts: number;
    fileSizeBytes: number;
  };
};

type Listener = (state: ActiveUploadMeta | null) => void;

let meta: ActiveUploadMeta | null = null;
let listeners = new Set<Listener>();

function persistMeta() {
  if (typeof window === 'undefined') return;
  if (meta) sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(meta));
  else sessionStorage.removeItem(ACTIVE_KEY);
}

function emit() {
  listeners.forEach((fn) => fn(meta));
  persistMeta();
}

export function subscribeActiveUpload(fn: Listener): () => void {
  listeners.add(fn);
  fn(meta);
  return () => listeners.delete(fn);
}

export function getActiveUpload(): ActiveUploadMeta | null {
  if (meta) return meta;
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveUploadMeta;
  } catch {
    return null;
  }
}

export function isUploadInFlight(): boolean {
  return meta?.phase === 'uploading' || meta?.phase === 'presigning';
}

async function cancelVideoQuietly(videoId: string) {
  try {
    await api.post(`/videos/${videoId}/cancel-upload`);
  } catch {
    /* ignore */
  }
}

export async function runBackgroundUpload(
  file: File,
  title: string,
  description: string,
  options: CompleteUploadOptions,
): Promise<string> {
  if (meta?.phase === 'uploading' || meta?.phase === 'presigning') {
    throw new Error('Another upload is already running.');
  }

  const contentType = resolveVideoContentType(file);
  meta = {
    videoId: '',
    fileName: file.name,
    title,
    description,
    options,
    phase: 'presigning',
    progress: 0,
    startedAt: new Date().toISOString(),
  };
  emit();

  const presignRes = await api.post('/videos/presigned-url', {
    contentType,
    fileSizeBytes: file.size,
  });
  const presignData = presignRes.data.data as VideoPresignResponse;
  const videoId = presignData.videoId;
  const multipartMeta =
    'uploadMode' in presignData && presignData.uploadMode === 'multipart'
      ? {
          partCount: presignData.partCount,
          partSize: presignData.partSize,
          completedParts: 0,
          fileSizeBytes: file.size,
        }
      : undefined;
  meta = {
    ...meta!,
    videoId,
    phase: 'uploading',
    progress: 0,
    uploadVia: multipartMeta ? 'multipart' : undefined,
    multipart: multipartMeta,
  };
  emit();

  try {
    const thumb = getUploadThumbnail();
    if (thumb) {
      const thumbType = resolveThumbnailContentType(thumb);
      const thumbRes = await api.post(`/videos/${videoId}/thumbnail/presigned-url`, {
        contentType: thumbType,
      });
      const { uploadUrl: thumbUrl } = thumbRes.data.data as { uploadUrl: string };
      await fetch(thumbUrl, {
        method: 'PUT',
        body: thumb,
        headers: { 'Content-Type': thumbType },
      });
    }

    const via = await putVideoToStorageFromPresign(file, presignData, contentType, (pct) => {
      if (meta) {
        const completedParts =
          meta.multipart != null
            ? Math.min(
                meta.multipart.partCount,
                Math.round((pct / 100) * meta.multipart.partCount),
              )
            : undefined;
        meta = {
          ...meta,
          progress: pct,
          phase: 'uploading',
          multipart:
            meta.multipart && completedParts != null
              ? { ...meta.multipart, completedParts }
              : meta.multipart,
        };
        emit();
      }
    });
    meta = meta ? { ...meta, uploadVia: via } : meta;
    emit();

    if (meta) {
      meta = { ...meta, phase: 'completing', progress: 100 };
      emit();
    }

    await api.post(`/videos/${videoId}/complete`, {
      title: title.trim(),
      description: description.trim() || undefined,
      categoryId: options.categoryId,
      skillTagIds: options.skillTagIds,
      visibility: options.visibility ?? 'public',
      scheduledPublishAt: options.scheduledPublishAt,
      playlistIds: options.playlistIds?.length ? options.playlistIds : undefined,
      videoType: options.videoType === 'short' ? 'short' : 'video',
    });

    meta = null;
    emit();
    return videoId;
  } catch (err) {
    await cancelVideoQuietly(videoId);
    meta = null;
    emit();
    throw err;
  }
}

export function abortActiveUpload() {
  const id = meta?.videoId;
  meta = null;
  emit();
  if (id) void cancelVideoQuietly(id);
}
