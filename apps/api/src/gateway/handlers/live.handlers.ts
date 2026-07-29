import type { Server } from 'socket.io';
import type { StreamEndReason } from '../../modules/streaming/entities/stream.entity';

/**
 * Pure broadcast helpers for the live/streaming domain. The gateway class owns
 * `@OnEvent` / `@SubscribeMessage` decorators and delegates to these helpers so
 * the file stays scannable without breaking event names or Nest DI.
 */

export type StreamStartedPayload = {
  streamId: string;
  userId: string;
  title: string;
  communityId?: string | null;
};

export function broadcastStreamStarted(server: Server, payload: StreamStartedPayload) {
  server.to('streams:live').emit('stream:started', payload);
  server.to(`stream:${payload.streamId}`).emit('stream:started', payload);
  server.to(`user:${payload.userId}`).emit('stream:started', payload);
  if (payload.communityId) {
    server.to(`community:${payload.communityId}`).emit('stream:started', payload);
  }
}

export type StreamEndedPayload = {
  streamId: string;
  userId: string;
  title: string;
  endReason?: StreamEndReason;
  communityId?: string | null;
};

export function broadcastStreamEnded(server: Server, payload: StreamEndedPayload) {
  server.to('streams:live').emit('stream:ended', payload);
  server.to(`stream:${payload.streamId}`).emit('stream:ended', payload);
  server.to(`user:${payload.userId}`).emit('stream:ended', payload);
  if (payload.communityId) {
    server.to(`community:${payload.communityId}`).emit('stream:ended', payload);
  }
}

export function broadcastStreamReconnecting(
  server: Server,
  payload: { streamId: string; userId: string; since: string; timeoutSec: number; attempt: number },
) {
  server.to(`stream:${payload.streamId}`).emit('stream:reconnecting', payload);
}

export function broadcastStreamReconnected(
  server: Server,
  payload: { streamId: string; userId: string },
) {
  server.to(`stream:${payload.streamId}`).emit('stream:reconnected', payload);
}

export function broadcastStreamChatMessage(
  server: Server,
  payload: { streamId: string; message: unknown },
) {
  server.to(`stream:${payload.streamId}`).emit('stream:chat:message', payload.message);
}

export function broadcastStreamChatDelete(
  server: Server,
  payload: { streamId: string; messageId: string },
) {
  server.to(`stream:${payload.streamId}`).emit('stream:chat:delete', payload);
}

export function broadcastStreamSlowMode(
  server: Server,
  payload: { streamId: string; slowModeSeconds: number },
) {
  server.to(`stream:${payload.streamId}`).emit('stream:chat:slow-mode', payload);
}

export function broadcastStreamChatPinned(
  server: Server,
  payload: { streamId: string; messageId: string | null },
) {
  server.to(`stream:${payload.streamId}`).emit('stream:chat:pinned', payload);
}

export function broadcastStreamChatSettings(
  server: Server,
  payload: { streamId: string; chatEnabled: boolean; chatMode: string },
) {
  server.to(`stream:${payload.streamId}`).emit('stream:chat:settings', payload);
}

export function broadcastStreamPollUpdated(
  server: Server,
  payload: { streamId: string; poll: unknown },
) {
  server.to(`stream:${payload.streamId}`).emit('stream:poll:updated', payload);
}

export function broadcastStreamQaCreated(
  server: Server,
  payload: { streamId: string; question: unknown },
) {
  server.to(`stream:${payload.streamId}`).emit('stream:qa:created', payload.question);
}

export function broadcastStreamQaUpdated(
  server: Server,
  payload: { streamId: string; question: unknown },
) {
  server.to(`stream:${payload.streamId}`).emit('stream:qa:updated', payload.question);
}

export function broadcastStreamReaction(
  server: Server,
  payload: { streamId: string; reaction: string; count: number },
) {
  server.to(`stream:${payload.streamId}`).emit('stream:reaction', payload);
}

export function broadcastStreamRaiseHand(
  server: Server,
  payload: { streamId: string; userId: string; raised: boolean; raisedAt?: string },
) {
  server.to(`stream:${payload.streamId}`).emit('stream:raise-hand', payload);
}

export function broadcastBreakoutStarted(
  server: Server,
  payload: { streamId: string; communityId: string; rooms: unknown[]; endsAt: string },
) {
  server.to(`stream:${payload.streamId}`).emit('stream:breakout:started', payload);
}

export function broadcastBreakoutAssigned(
  server: Server,
  payload: {
    streamId: string;
    communityId: string;
    assignments: Array<{ userId: string; roomId: string }>;
  },
) {
  for (const { userId, roomId } of payload.assignments) {
    server
      .to(`user:${userId}`)
      .emit('stream:breakout:join', { roomId, streamId: payload.streamId });
  }
}

export function broadcastBreakoutEnded(
  server: Server,
  payload: { streamId: string; communityId: string },
) {
  server.to(`stream:${payload.streamId}`).emit('stream:breakout:ended', payload);
}

export function broadcastCoHostAdded(
  server: Server,
  payload: { streamId: string; creatorId: string; coHostId: string },
) {
  server
    .to(`user:${payload.coHostId}`)
    .emit('stream:cohost:invited', { streamId: payload.streamId, creatorId: payload.creatorId });
}

export function broadcastVideoReady(
  server: Server,
  payload: { videoId: string; userId: string; status?: string; hlsUrl?: string; thumbnailUrl?: string },
) {
  const body = {
    videoId: payload.videoId,
    status: payload.status ?? 'ready',
    hlsUrl: payload.hlsUrl,
    thumbnailUrl: payload.thumbnailUrl,
    message: 'Your video is ready!',
  };
  server.to(`user:${payload.userId}`).emit('video:ready', body);
  server.to(`video:${payload.videoId}`).emit('video:ready', body);
}

export function broadcastCommentCreated(
  server: Server,
  payload: { videoId: string; comment: unknown },
) {
  server.to(`video:${payload.videoId}`).emit('comment:new', payload.comment);
}
