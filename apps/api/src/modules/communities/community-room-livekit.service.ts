import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { CommunityRoomType } from './entities/community-room.entity';

@Injectable()
export class CommunityRoomLivekitService {
  private readonly logger = new Logger(CommunityRoomLivekitService.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return !!(
      this.configService.get<string>('livekit.url') &&
      this.configService.get<string>('livekit.apiKey') &&
      this.configService.get<string>('livekit.apiSecret')
    );
  }

  roomName(communityId: string, roomId: string): string {
    return `forge-community-${communityId}-${roomId}`;
  }

  async ensureRoom(
    communityId: string,
    roomId: string,
    roomType: CommunityRoomType,
    maxParticipants?: number | null,
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('LiveKit is not configured for voice rooms');
    }

    const name = this.roomName(communityId, roomId);
    const client = this.roomClient();
    try {
      await client.createRoom({
        name,
        emptyTimeout: 600,
        maxParticipants: maxParticipants ?? (roomType === CommunityRoomType.STAGE ? 50 : 25),
      });
    } catch (err) {
      this.logger.debug(`LiveKit room create: ${err instanceof Error ? err.message : err}`);
    }
    return name;
  }

  async createJoinToken(input: {
    communityId: string;
    roomId: string;
    userId: string;
    roomType: CommunityRoomType;
    displayName?: string;
    canPublish?: boolean;
  }): Promise<{ token: string; roomName: string; livekitUrl: string }> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('LiveKit is not configured');
    }

    const roomName = await this.ensureRoom(
      input.communityId,
      input.roomId,
      input.roomType,
    );

    const canPublish =
      input.canPublish ??
      (input.roomType === CommunityRoomType.VOICE || input.roomType === CommunityRoomType.BREAKOUT);

    const token = new AccessToken(
      this.configService.get<string>('livekit.apiKey')!,
      this.configService.get<string>('livekit.apiSecret')!,
      {
        identity: input.userId,
        name: input.displayName,
        ttl: '2h',
      },
    );
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish,
      canSubscribe: true,
    });

    return {
      token: await token.toJwt(),
      roomName,
      livekitUrl: this.configService.get<string>('livekit.url')!,
    };
  }

  /**
   * Revokes an already-connected participant's publish rights immediately —
   * a fixed-TTL join token has no server-side revocation on its own, so
   * without this a demoted/removed stage speaker could keep broadcasting
   * audio/video until their token naturally expires (up to 2h). Swallows
   * errors: the participant may have already disconnected, which is fine.
   */
  async revokePublish(communityId: string, roomId: string, userId: string): Promise<void> {
    if (!this.isConfigured()) return;
    const name = this.roomName(communityId, roomId);
    try {
      await this.roomClient().updateParticipant(name, userId, undefined, {
        canPublish: false,
        canSubscribe: true,
      });
    } catch (err) {
      this.logger.debug(`LiveKit revokePublish: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Fully ends the live LiveKit room, disconnecting every current
   * participant immediately — used when a room is deactivated so it doesn't
   * silently keep running for whoever is already connected.
   */
  async endRoom(communityId: string, roomId: string): Promise<void> {
    if (!this.isConfigured()) return;
    const name = this.roomName(communityId, roomId);
    try {
      await this.roomClient().deleteRoom(name);
    } catch (err) {
      this.logger.debug(`LiveKit endRoom: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * LiveKit's createRoom({maxParticipants}) only applies at first-creation —
   * there is no API to change an existing room's cap (confirmed: RoomServiceClient
   * has no updateRoom-with-maxParticipants method, only updateRoomMetadata).
   * So a capacity lowered later via updateRoom would silently keep the old,
   * larger LiveKit-enforced limit. The real fix is enforcing the current DB
   * value ourselves at token-issuance time using the live participant count,
   * rather than trusting LiveKit's possibly-stale internal cap.
   */
  async getParticipantCount(communityId: string, roomId: string): Promise<number> {
    if (!this.isConfigured()) return 0;
    const name = this.roomName(communityId, roomId);
    try {
      const participants = await this.roomClient().listParticipants(name);
      return participants.length;
    } catch (err) {
      this.logger.debug(`LiveKit listParticipants: ${err instanceof Error ? err.message : err}`);
      return 0;
    }
  }

  private roomClient(): RoomServiceClient {
    const url = this.configService.get<string>('livekit.url')!;
    const host = url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    return new RoomServiceClient(
      host,
      this.configService.get<string>('livekit.apiKey')!,
      this.configService.get<string>('livekit.apiSecret')!,
    );
  }
}
