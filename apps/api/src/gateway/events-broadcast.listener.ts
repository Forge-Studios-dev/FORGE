import { Injectable, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { StreamEndReason } from '../modules/streaming/entities/stream.entity';
import { StreamingService } from '../modules/streaming/streaming.service';
import { SocketIoHub } from './socket-io.hub';

/**
 * Domain event → Socket.IO room broadcasts extracted from EventsGateway (M-B3).
 * SubscribeMessage handlers remain on the gateway; emits live here.
 */
@Injectable()
export class EventsBroadcastListener {
  constructor(
    private readonly hub: SocketIoHub,
    @Optional() private readonly streamingService?: StreamingService,
  ) {}

  private emit(room: string, event: string, payload: unknown): void {
    if (!this.hub.io) return;
    this.hub.to(room).emit(event, payload);
  }

  @OnEvent('video.ready')
  handleVideoReady(payload: {
    videoId: string;
    userId: string;
    status?: string;
    hlsUrl?: string;
    thumbnailUrl?: string;
  }) {
    const body = {
      videoId: payload.videoId,
      status: payload.status ?? 'ready',
      hlsUrl: payload.hlsUrl,
      thumbnailUrl: payload.thumbnailUrl,
      message: 'Your video is ready!',
    };
    this.emit(`user:${payload.userId}`, 'video:ready', body);
    this.emit(`video:${payload.videoId}`, 'video:ready', body);
  }

  @OnEvent('stream.started')
  handleStreamStarted(payload: {
    streamId: string;
    userId: string;
    title: string;
    communityId?: string | null;
  }) {
    void this.streamingService?.invalidateStreamListCache();
    this.emit('streams:live', 'stream:started', payload);
    this.emit(`stream:${payload.streamId}`, 'stream:started', payload);
    this.emit(`user:${payload.userId}`, 'stream:started', payload);
    if (payload.communityId) {
      this.emit(`community:${payload.communityId}`, 'stream:started', payload);
    }
  }

  @OnEvent('stream.ended')
  handleStreamEnded(payload: {
    streamId: string;
    userId: string;
    title: string;
    endReason?: StreamEndReason;
    communityId?: string | null;
  }) {
    void this.streamingService?.invalidateStreamListCache();
    this.emit('streams:live', 'stream:ended', payload);
    this.emit(`stream:${payload.streamId}`, 'stream:ended', payload);
    this.emit(`user:${payload.userId}`, 'stream:ended', payload);
    if (payload.communityId) {
      this.emit(`community:${payload.communityId}`, 'stream:ended', payload);
    }
  }

  @OnEvent('stream.reconnecting')
  handleStreamReconnecting(payload: {
    streamId: string;
    userId: string;
    since: string;
    timeoutSec: number;
    attempt: number;
  }) {
    this.emit(`stream:${payload.streamId}`, 'stream:reconnecting', payload);
  }

  @OnEvent('stream.reconnected')
  handleStreamReconnected(payload: { streamId: string; userId: string }) {
    this.emit(`stream:${payload.streamId}`, 'stream:reconnected', payload);
  }

  @OnEvent('comment.created')
  handleCommentCreated(payload: { videoId: string; comment: unknown }) {
    this.emit(`video:${payload.videoId}`, 'comment:new', payload.comment);
  }

  @OnEvent('stream.chat.message')
  handleStreamChatMessage(payload: { streamId: string; message: unknown }) {
    this.emit(`stream:${payload.streamId}`, 'stream:chat:message', payload.message);
  }

  @OnEvent('stream.chat.delete')
  handleStreamChatDelete(payload: { streamId: string; messageId: string }) {
    this.emit(`stream:${payload.streamId}`, 'stream:chat:delete', payload);
  }

  @OnEvent('stream.slow-mode')
  handleStreamSlowMode(payload: { streamId: string; slowModeSeconds: number }) {
    this.emit(`stream:${payload.streamId}`, 'stream:chat:slow-mode', payload);
  }

  @OnEvent('stream.chat.pinned')
  handleStreamChatPinned(payload: { streamId: string; messageId: string | null }) {
    this.emit(`stream:${payload.streamId}`, 'stream:chat:pinned', payload);
  }

  @OnEvent('stream.chat.settings')
  handleStreamChatSettings(payload: {
    streamId: string;
    chatEnabled: boolean;
    chatMode: string;
  }) {
    this.emit(`stream:${payload.streamId}`, 'stream:chat:settings', payload);
  }

  @OnEvent('stream.poll.updated')
  handleStreamPollUpdated(payload: { streamId: string; poll: unknown }) {
    this.emit(`stream:${payload.streamId}`, 'stream:poll:updated', payload);
  }

  @OnEvent('stream.qa.created')
  handleStreamQaCreated(payload: { streamId: string; question: unknown }) {
    this.emit(`stream:${payload.streamId}`, 'stream:qa:created', payload.question);
  }

  @OnEvent('stream.qa.updated')
  handleStreamQaUpdated(payload: { streamId: string; question: unknown }) {
    this.emit(`stream:${payload.streamId}`, 'stream:qa:updated', payload.question);
  }

  @OnEvent('channel.message')
  handleChannelMessage(payload: { channelId: string; message: unknown }) {
    this.emit(`channel:${payload.channelId}`, 'channel:message', payload.message);
  }

  @OnEvent('channel.message.deleted')
  handleChannelMessageDeleted(payload: { channelId: string; messageId: string }) {
    this.emit(`channel:${payload.channelId}`, 'channel:message:delete', payload);
  }

  @OnEvent('room.message')
  handleRoomMessage(payload: { communityId: string; roomId: string; message: unknown }) {
    this.emit(`room:${payload.roomId}`, 'room:message', payload.message);
  }

  @OnEvent('room.message.deleted')
  handleRoomMessageDeleted(payload: { communityId: string; roomId: string; messageId: string }) {
    this.emit(`room:${payload.roomId}`, 'room:message:delete', payload);
  }

  @OnEvent('community.post.created')
  handleCommunityPostCreated(payload: { communityId: string; post: unknown }) {
    this.emit(`community:${payload.communityId}`, 'post:created', payload.post);
  }

  @OnEvent('community.post.comment.created')
  handleCommunityPostComment(payload: {
    communityId: string;
    postId: string;
    comment: unknown;
  }) {
    this.emit(`community:${payload.communityId}`, 'post:comment:created', {
      postId: payload.postId,
      comment: payload.comment,
    });
  }

  @OnEvent('community.poll.updated')
  handleCommunityPollUpdated(payload: { communityId: string; poll: unknown }) {
    this.emit(`community:${payload.communityId}`, 'poll:updated', payload.poll);
  }

  @OnEvent('notification.created')
  handleNotificationCreated(payload: { userId: string; notification: unknown }) {
    this.emit(`user:${payload.userId}`, 'notification:new', payload.notification);
  }

  @OnEvent('direct-message.sent')
  handleDirectMessageSent(payload: {
    conversationId: string;
    message: unknown;
    recipientIds: string[];
  }) {
    for (const userId of payload.recipientIds) {
      this.emit(`user:${userId}`, 'dm:message', payload.message);
    }
    this.emit(`conversation:${payload.conversationId}`, 'dm:message', payload.message);
  }

  @OnEvent('stream.reaction')
  handleStreamReaction(payload: { streamId: string; reaction: string; count: number }) {
    this.emit(`stream:${payload.streamId}`, 'stream:reaction', payload);
  }

  @OnEvent('stream.raise-hand')
  handleStreamRaiseHand(payload: {
    streamId: string;
    userId: string;
    raised: boolean;
    raisedAt?: string;
  }) {
    this.emit(`stream:${payload.streamId}`, 'stream:raise-hand', payload);
  }

  @OnEvent('room.raise-hand')
  handleRoomRaiseHand(payload: {
    communityId: string;
    roomId: string;
    userId: string;
    raised: boolean;
    raisedAt?: string;
  }) {
    this.emit(`room:${payload.roomId}`, 'room:raise-hand', payload);
  }

  @OnEvent('room.speaker.approved')
  handleRoomSpeakerApproved(payload: {
    communityId: string;
    roomId: string;
    userId: string;
  }) {
    this.emit(`room:${payload.roomId}`, 'room:speaker:approved', payload);
    this.emit(`user:${payload.userId}`, 'room:speaker:approved', payload);
  }

  @OnEvent('stream.breakout.started')
  handleBreakoutStarted(payload: { streamId: string; communityId: string; rooms: unknown[]; endsAt: string }) {
    this.emit(`stream:${payload.streamId}`, 'stream:breakout:started', payload);
  }

  @OnEvent('stream.breakout.assigned')
  handleBreakoutAssigned(payload: {
    streamId: string;
    communityId: string;
    assignments: Array<{ userId: string; roomId: string }>;
  }) {
    for (const { userId, roomId } of payload.assignments) {
      this.emit(`user:${userId}`, 'stream:breakout:join', { roomId, streamId: payload.streamId });
    }
  }

  @OnEvent('stream.breakout.ended')
  handleBreakoutEnded(payload: { streamId: string; communityId: string }) {
    this.emit(`stream:${payload.streamId}`, 'stream:breakout:ended', payload);
  }

  @OnEvent('channel_points.redeemed')
  handleChannelPointsRedeemed(payload: {
    communityId: string;
    rewardId: string;
    userId: string;
    redemptionId: string;
    requiresApproval: boolean;
  }) {
    this.emit(`community:${payload.communityId}:mods`, 'channel_points:redemption', payload);
    if (!payload.requiresApproval) {
      this.emit(`user:${payload.userId}`, 'channel_points:fulfilled', { redemptionId: payload.redemptionId });
    }
  }

  @OnEvent('stream.cohost.added')
  handleCoHostAdded(payload: { streamId: string; creatorId: string; coHostId: string }) {
    this.emit(`user:${payload.coHostId}`, 'stream:cohost:invited', {
      streamId: payload.streamId,
      creatorId: payload.creatorId,
    });
  }

  @OnEvent('follow.created')
  handleFollowCreated(payload: { followerId: string; followingId: string }) {
    this.emit(`analytics:creator:${payload.followingId}`, 'analytics:update', {
      type: 'new_follower',
      followerId: payload.followerId,
    });
  }

  @OnEvent('community.member.provision')
  handleCommunityMemberProvision(payload: { userId: string; communityId: string; creatorId?: string }) {
    if (!payload.creatorId) return;
    this.emit(`analytics:creator:${payload.creatorId}`, 'analytics:update', {
      type: 'new_community_member',
      communityId: payload.communityId,
      userId: payload.userId,
    });
  }

  @OnEvent('community.ownership.transferred')
  handleOwnershipTransferred(payload: {
    communityId: string;
    previousOwnerId: string;
    newOwnerId: string;
  }) {
    this.emit(`user:${payload.previousOwnerId}`, 'community:ownership:transferred', payload);
    this.emit(`user:${payload.newOwnerId}`, 'community:ownership:transferred', payload);
  }
}
