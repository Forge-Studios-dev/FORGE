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

export type FeedSort = 'latest' | 'popular';

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
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

export * from './access';
export { hasPermission as hasAccessPermission } from './access';
export * from './jwt';
export * from './feature-flags';
