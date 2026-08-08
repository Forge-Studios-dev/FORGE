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

export async function toggleVideoDislike(videoId: string, disliked: boolean): Promise<void> {
  if (disliked) {
    await api.delete(`/videos/${videoId}/dislike`);
  } else {
    await api.post(`/videos/${videoId}/dislike`);
  }
}

/** Subscribe / unsubscribe (YouTube model). Uses channel subscribe API. */
export async function toggleSubscribe(channelId: string, subscribed: boolean): Promise<void> {
  if (subscribed) {
    await api.delete(`/channels/${channelId}/subscribe`);
  } else {
    await api.post(`/channels/${channelId}/subscribe`);
  }
}

export type ChannelNotifyLevel = 'all' | 'personalized' | 'none';

export async function getChannelSubscription(channelId: string): Promise<{
  subscribed: boolean;
  notifyLevel: ChannelNotifyLevel | null;
}> {
  const { data } = await api.get<{
    data: { subscribed: boolean; notifyLevel: ChannelNotifyLevel | null };
  }>(`/channels/${channelId}/subscription`);
  return data.data;
}

export async function setChannelNotifyLevel(
  channelId: string,
  notifyLevel: ChannelNotifyLevel,
): Promise<void> {
  await api.patch(`/channels/${channelId}/subscription/notify`, { notifyLevel });
}

/** @deprecated Use toggleSubscribe */
export async function toggleFollow(userId: string, following: boolean): Promise<void> {
  return toggleSubscribe(userId, following);
}

export async function addToWatchLater(videoId: string): Promise<void> {
  await api.post('/playlists/me/watch-later/videos', { videoId });
}

export async function removeFromWatchLater(videoId: string): Promise<void> {
  await api.delete(`/playlists/me/watch-later/videos/${videoId}`);
}

export async function toggleWatchLater(videoId: string, currentlySaved: boolean): Promise<void> {
  if (currentlySaved) {
    await removeFromWatchLater(videoId);
  } else {
    await addToWatchLater(videoId);
  }
}

export async function isInWatchLater(videoId: string): Promise<boolean> {
  const { data } = await api.get<{ data?: { inWatchLater?: boolean }; inWatchLater?: boolean }>(
    `/playlists/me/watch-later/contains/${videoId}`,
  );
  const payload = data.data ?? data;
  return !!payload.inWatchLater;
}

export async function blockUser(userId: string): Promise<void> {
  await api.post(`/users/${userId}/block`);
}

export async function unblockUser(userId: string): Promise<void> {
  await api.delete(`/users/${userId}/block`);
}
