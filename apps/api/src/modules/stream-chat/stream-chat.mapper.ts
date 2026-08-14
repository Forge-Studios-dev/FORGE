import {
  StreamMessage,
  StreamMessageType,
  StreamQuestionStatus,
} from './entities/stream-message.entity';
import { toPublicUserProfile } from '../users/user.mapper';

export function toPublicStreamQuestion(msg: StreamMessage, viewerHasUpvoted = false) {
  return {
    id: msg.id,
    streamId: msg.streamId,
    userId: msg.userId,
    user: msg.user ? toPublicUserProfile(msg.user) : undefined,
    body: msg.deletedAt ? '[deleted]' : msg.body,
    status: msg.questionStatus ?? StreamQuestionStatus.PENDING,
    upvotes: msg.upvotes ?? 0,
    viewerHasUpvoted,
    deletedAt: msg.deletedAt,
    createdAt: msg.createdAt,
  };
}

export function toPublicStreamMessage(msg: StreamMessage) {
  return {
    id: msg.id,
    streamId: msg.streamId,
    userId: msg.userId,
    user: msg.user ? toPublicUserProfile(msg.user) : undefined,
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
