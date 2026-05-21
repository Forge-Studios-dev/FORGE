import { api } from '@/lib/api';
import { putVideoToStorage } from '@/lib/upload-storage';
import type { CompleteUploadOptions, UploadPhase } from '@/lib/upload-lesson';
import { resolveVideoContentType } from '@/lib/upload-lesson';

const ACTIVE_KEY = 'forge_active_upload';

export type ActiveUploadMeta = {
  videoId: string;
  fileName: string;
  title: string;
  description: string;
  skillTag?: string;
  options?: CompleteUploadOptions;
  phase: UploadPhase;
  progress: number;
  startedAt: string;
  uploadVia?: 'direct' | 'proxy';
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
  skillTagName?: string,
  options?: CompleteUploadOptions,
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
    skillTag: skillTagName,
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
  const { videoId, uploadUrl } = presignRes.data.data as { videoId: string; uploadUrl: string };
  meta = { ...meta!, videoId, phase: 'uploading', progress: 0 };
  emit();

  try {
    const via = await putVideoToStorage(videoId, uploadUrl, file, contentType, (pct) => {
      if (meta) {
        meta = { ...meta, progress: pct, phase: 'uploading' };
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
      skillTagName: skillTagName?.trim() || undefined,
      visibility: options?.visibility ?? 'public',
      scheduledPublishAt: options?.scheduledPublishAt,
      playlistIds: options?.playlistIds?.length ? options.playlistIds : undefined,
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
