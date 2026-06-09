import { StreamMessage, StreamMessageType } from './entities/stream-message.entity';
import { toPublicUser } from '../users/user.mapper';

export function toPublicStreamMessage(msg: StreamMessage) {
  return {
    id: msg.id,
    streamId: msg.streamId,
    userId: msg.userId,
    user: msg.user ? toPublicUser(msg.user) : undefined,
    body: msg.deletedAt ? '[deleted]' : msg.body,
    parentId: msg.parentId,
    deletedAt: msg.deletedAt,
    createdAt: msg.createdAt,
    streamOffsetMs: msg.streamOffsetMs != null ? Number(msg.streamOffsetMs) : null,
    messageType: msg.messageType ?? StreamMessageType.CHAT,
    amountCents: msg.amountCents ?? null,
    highlightSeconds: msg.highlightSeconds ?? null,
  };
}
