import { AxiosError } from 'axios';
import { api } from '@/lib/api';
import type { EngageBlockReason } from '@/lib/engage-access';

type ApiErrorBody = { message?: string; code?: string };

export function engageErrorReason(error: unknown): EngageBlockReason | 'failed' {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.code === 'EMAIL_NOT_VERIFIED') return 'unverified';
    if (error.response?.status === 401) return 'guest';
  }
  return 'failed';
}

export async function toggleVideoLike(videoId: string, liked: boolean): Promise<void> {
  if (liked) {
    await api.delete(`/videos/${videoId}/like`);
  } else {
    await api.post(`/videos/${videoId}/like`);
  }
}

export async function toggleFollow(userId: string, following: boolean): Promise<void> {
  if (following) {
    await api.delete(`/follow/${userId}`);
  } else {
    await api.post(`/follow/${userId}`);
  }
}
