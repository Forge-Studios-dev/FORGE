import { uploadApi } from '@/lib/upload-api';

export type StoragePutProgress = (pct: number) => void;

function assertBrowserSafePresignUrl(uploadUrl: string): void {
  const lower = uploadUrl.toLowerCase();
  if (lower.includes('checksum') || lower.includes('x-amz-checksum')) {
    throw new Error(
      'Storage presign is misconfigured (checksum in URL). Redeploy the API and try again.',
    );
  }
}

function xhrPut(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: StoragePutProgress,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);
    request.setRequestHeader('Content-Type', contentType);
    request.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Direct storage upload failed (HTTP ${request.status}). Retrying via API…`,
        ),
      );
    };
    request.onerror = () => {
      reject(new Error('Direct storage upload blocked (network/CORS). Retrying via API…'));
    };
    request.onabort = () => reject(new Error('Upload cancelled.'));
    request.send(file);
  });
}

async function fetchPut(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: StoragePutProgress,
): Promise<void> {
  assertBrowserSafePresignUrl(uploadUrl);
  if (typeof XMLHttpRequest !== 'undefined') {
    return xhrPut(uploadUrl, file, contentType, onProgress);
  }
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
    mode: 'cors',
    credentials: 'omit',
  });
  if (!res.ok) {
    throw new Error(`Direct storage upload failed (HTTP ${res.status}). Retrying via API…`);
  }
  onProgress?.(100);
}

async function proxyPut(
  videoId: string,
  file: File,
  onProgress?: StoragePutProgress,
): Promise<void> {
  const form = new FormData();
  form.append('file', file, file.name);
  await uploadApi.put(`/videos/${videoId}/upload`, form, {
    onUploadProgress: (evt) => {
      if (evt.total && onProgress) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    },
  });
}

/**
 * Try direct S3 presigned PUT; on failure fall back to API multipart upload (no S3 CORS).
 */
export async function putVideoToStorage(
  videoId: string,
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: StoragePutProgress,
): Promise<'direct' | 'proxy'> {
  try {
    await fetchPut(uploadUrl, file, contentType, onProgress);
    return 'direct';
  } catch (directErr) {
    const reason =
      directErr instanceof Error ? directErr.message : 'Direct upload failed';
    if (reason.includes('cancelled')) throw directErr;
    try {
      onProgress?.(0);
      await proxyPut(videoId, file, onProgress);
      return 'proxy';
    } catch (proxyErr) {
      const proxyMsg =
        proxyErr instanceof Error
          ? proxyErr.message
          : 'API upload failed';
      const apiDetail =
        (proxyErr as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? '';
      throw new Error(
        apiDetail ||
          `${proxyMsg}. (${reason})`,
      );
    }
  }
}
