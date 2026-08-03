/**
 * Shared contracts between API, web, admin, mobile, and tooling.
 */

export type HealthStatus = 'ok' | 'degraded';

export interface HealthPayload {
  status: HealthStatus;
  timestamp: string;
  checks?: Record<string, string>;
  correlationId?: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export type FeedSort = 'latest' | 'popular' | 'forYou' | 'following';

export interface FeedMeta {
  cursor: string | null;
  hasMore: boolean;
}

export interface PaginatedFeedPayload<T> {
  data: T[];
  meta: FeedMeta;
}

/** Socket.IO event names emitted by the API gateway (keep in sync with apps/api/src/gateway/events.gateway.ts). */
export const SocketEvents = {
  STREAM_STARTED: 'stream:started',
  STREAM_ENDED: 'stream:ended',
  VIDEO_READY: 'video:ready',
  COMMENT_NEW: 'comment:new',
  STREAM_CHAT_MESSAGE: 'stream:chat:message',
  STREAM_CHAT_DELETE: 'stream:chat:delete',
  STREAM_CHAT_SLOW_MODE: 'stream:chat:slow-mode',
  STREAM_CHAT_PINNED: 'stream:chat:pinned',
  STREAM_CHAT_SETTINGS: 'stream:chat:settings',
  STREAM_POLL_UPDATED: 'stream:poll:updated',
  STREAM_QA_CREATED: 'stream:qa:created',
  STREAM_QA_UPDATED: 'stream:qa:updated',
  STREAM_RAISE_HAND: 'stream:raise-hand',
  CHANNEL_MESSAGE: 'channel:message',
  CHANNEL_MESSAGE_DELETE: 'channel:message:delete',
  ROOM_MESSAGE: 'room:message',
  ROOM_MESSAGE_DELETE: 'room:message:delete',
  ROOM_RAISE_HAND: 'room:raise-hand',
  ROOM_SPEAKER_APPROVED: 'room:speaker:approved',
  STREAM_VIEWER_COUNT: 'stream:viewer-count',
  NOTIFICATION_NEW: 'notification:new',
  DM_MESSAGE: 'dm:message',
  STREAM_REACTION: 'stream:reaction',
  /** Host ingest went idle — grace-period countdown started, stream stays LIVE. */
  STREAM_RECONNECTING: 'stream:reconnecting',
  /** Host ingest resumed before the grace period expired. */
  STREAM_RECONNECTED: 'stream:reconnected',
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

export * from './access';
export { hasPermission as hasAccessPermission } from './access';
export * from './jwt';
export * from './consumer-session';
export * from './safe-return-path';
export * from './feature-flags';
export * from './platform-public-config';
export * from './analytics';
export * from './content-visibility';
export * from './entitlements';
export * from './csrf';
export * from './domain';
