import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CommunityRoomsService } from './community-rooms.service';

/**
 * After a community-linked live stream ends, provision a TEXT discussion room so
 * members can keep the conversation going. Reuses the standard community-room
 * infrastructure (permissions, moderation, messaging, sockets) rather than
 * introducing a parallel system.
 *
 * Runs off the request path (EventEmitter2 does not await async handlers) and is
 * fully best-effort: any failure (stream not linked to a community, host lacks
 * studio access, transient DB error) is logged and swallowed so it can never
 * affect the stream-end flow. Room creation is idempotent on the source stream,
 * so duplicate/retried `stream.ended` events do not create duplicate rooms.
 */
@Injectable()
export class AfterLiveRoomListener {
  private readonly logger = new Logger(AfterLiveRoomListener.name);

  constructor(private readonly communityRoomsService: CommunityRoomsService) {}

  @OnEvent('stream.ended')
  async onStreamEnded(payload: {
    streamId: string;
    userId: string;
    title?: string | null;
    communityId?: string | null;
  }): Promise<void> {
    if (!payload?.communityId || !payload.streamId || !payload.userId) return;
    try {
      const room = await this.communityRoomsService.ensureAfterLiveRoom(
        payload.userId,
        payload.communityId,
        payload.streamId,
        payload.title,
      );
      this.logger.log(
        `After-live room ${room.id} ready for stream ${payload.streamId} in community ${payload.communityId}`,
      );
    } catch (err) {
      this.logger.warn(
        `After-live room creation skipped for stream ${payload.streamId}: ${String(err)}`,
      );
    }
  }
}
