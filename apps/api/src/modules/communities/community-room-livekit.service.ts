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
