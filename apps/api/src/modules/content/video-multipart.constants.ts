/** Use S3 multipart when file size >= 50 MB and feature flag `multipart_upload` is on. */
export const MULTIPART_MIN_FILE_BYTES = 50 * 1024 * 1024;

/** 10 MiB per part (S3 minimum 5 MiB except last part). */
export const MULTIPART_PART_SIZE_BYTES = 10 * 1024 * 1024;

export const MULTIPART_REDIS_PREFIX = 'video:multipart:';
export const MULTIPART_REDIS_TTL_SEC = 24 * 3600;
export const MULTIPART_MAX_PARTS_PER_REQUEST = 20;

export type MultipartCompletedPart = {
  partNumber: number;
  etag: string;
};

export type MultipartUploadState = {
  userId: string;
  uploadId: string;
  key: string;
  contentType: string;
  partSize: number;
  partCount: number;
  /** Server-side checkpoint for resume across devices/tabs */
  completedParts?: MultipartCompletedPart[];
};
