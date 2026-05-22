import { uploadApi } from '@/lib/upload-api';
import {
  clearMultipartSession,
  loadMultipartSession,
  mergeMultipartParts,
  pendingPartNumbers,
  saveMultipartSession,
  type MultipartPartEtag,
} from '@/lib/multipart-session';

export type MultipartPresignResponse = {
  uploadMode: 'multipart';
  videoId: string;
  partSize: number;
  partCount: number;
};

export type SinglePresignResponse = {
  uploadMode?: 'single';
  videoId: string;
  uploadUrl: string;
};

export type VideoPresignResponse = MultipartPresignResponse | SinglePresignResponse;

function isMultipartPresign(
  data: VideoPresignResponse,
): data is MultipartPresignResponse {
  return data.uploadMode === 'multipart';
}

async function uploadPart(
  url: string,
  blob: Blob,
  contentType: string,
): Promise<string> {
  const res = await fetch(url, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': contentType },
  });
  if (!res.ok) {
    throw new Error(`Part upload failed (HTTP ${res.status})`);
  }
  const etag = res.headers.get('ETag') || res.headers.get('etag');
  if (!etag) throw new Error('Part upload missing ETag header');
  return etag;
}

const PART_URL_BATCH = 10;
const UPLOAD_CONCURRENCY = 3;

async function loadServerCheckpoint(videoId: string): Promise<MultipartPartEtag[]> {
  try {
    const { data } = await uploadApi.get(`/videos/${videoId}/multipart/progress`);
    return (data.data.completedParts ?? []) as MultipartPartEtag[];
  } catch {
    return [];
  }
}

async function checkpointParts(videoId: string, parts: MultipartPartEtag[]): Promise<void> {
  if (parts.length === 0) return;
  await uploadApi.post(`/videos/${videoId}/multipart/checkpoint`, { parts });
}

/**
 * Resumable S3 multipart upload (server-assembled).
 * Requires API feature flag `multipart_upload` and file size >= 50MB.
 * Progress persists in sessionStorage and API Redis (24h) for cross-tab resume.
 */
export async function putVideoMultipartToStorage(
  file: File,
  presign: MultipartPresignResponse,
  contentType: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const { videoId, partSize, partCount } = presign;
  const serverParts = await loadServerCheckpoint(videoId);
  let etags = mergeMultipartParts(loadMultipartSession(videoId), serverParts);
  saveMultipartSession(videoId, etags);

  const pending = pendingPartNumbers(partCount, etags);

  for (let i = 0; i < pending.length; i += PART_URL_BATCH) {
    const partNumbers = pending.slice(i, i + PART_URL_BATCH);

    const { data } = await uploadApi.post(`/videos/${videoId}/multipart/parts`, {
      partNumbers,
    });
    const signed = data.data.parts as { partNumber: number; uploadUrl: string }[];

    const queue = [...signed];
    const batchCompleted: MultipartPartEtag[] = [];
    const workers = Array.from(
      { length: Math.min(UPLOAD_CONCURRENCY, queue.length) },
      async () => {
        while (queue.length > 0) {
          const next = queue.shift();
          if (!next) break;
          const { partNumber, uploadUrl } = next;
          const start = (partNumber - 1) * partSize;
          const end = Math.min(start + partSize, file.size);
          const blob = file.slice(start, end);
          const etag = await uploadPart(uploadUrl, blob, contentType);
          batchCompleted.push({ partNumber, etag });
        }
      },
    );
    await Promise.all(workers);
    etags = mergeMultipartParts(etags, batchCompleted);
    saveMultipartSession(videoId, etags);
    onProgress?.(Math.min(99, Math.round((etags.length / partCount) * 100)));
    await checkpointParts(videoId, batchCompleted);
  }

  etags = mergeMultipartParts([], etags);
  if (etags.length !== partCount) {
    throw new Error(`Multipart upload incomplete (${etags.length}/${partCount} parts)`);
  }
  await uploadApi.post(`/videos/${videoId}/multipart/complete`, { parts: etags });
  clearMultipartSession(videoId);
  onProgress?.(100);
}

export async function putVideoToStorageFromPresign(
  file: File,
  presign: VideoPresignResponse,
  contentType: string,
  onProgress?: (pct: number) => void,
): Promise<'direct' | 'proxy' | 'multipart'> {
  if (isMultipartPresign(presign)) {
    await putVideoMultipartToStorage(file, presign, contentType, onProgress);
    return 'multipart';
  }
  const { putVideoToStorage } = await import('@/lib/upload-storage');
  const via = await putVideoToStorage(
    presign.videoId,
    presign.uploadUrl,
    file,
    contentType,
    onProgress,
  );
  return via;
}
