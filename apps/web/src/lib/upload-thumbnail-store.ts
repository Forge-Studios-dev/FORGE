let pendingThumbnailFile: File | null = null;

export function setUploadThumbnail(file: File | null) {
  pendingThumbnailFile = file;
}

export function getUploadThumbnail(): File | null {
  return pendingThumbnailFile;
}

export function clearUploadThumbnail() {
  pendingThumbnailFile = null;
}

export function resolveThumbnailContentType(file: File): string {
  if (file.type === 'image/png') return 'image/png';
  if (file.type === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}
