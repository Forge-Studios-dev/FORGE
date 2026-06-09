import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  EgressClient,
  RoomServiceClient,
  StreamOutput,
  StreamProtocol,
} from 'livekit-server-sdk';
import { StreamingService } from '../streaming/streaming.service';
import { StreamStatus } from '../streaming/entities/stream.entity';

@Injectable()
export class LiveBroadcastService {
  private readonly logger = new Logger(LiveBroadcastService.name);
  private readonly activeEgress = new Map<string, string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly streamingService: StreamingService,
  ) {}

  isConfigured(): boolean {
    return !!(
      this.configService.get<string>('livekit.url') &&
      this.configService.get<string>('livekit.apiKey') &&
      this.configService.get<string>('livekit.apiSecret')
    );
  }

  private roomName(streamId: string): string {
    return `forge-stream-${streamId}`;
  }

  async createPublisherToken(streamId: string, userId: string): Promise<{ token: string; roomName: string }> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Browser broadcasting is not configured');
    }

    const stream = await this.streamingService.findById(streamId);
    if (stream.userId !== userId) throw new NotFoundException('Stream not found');
    if (stream.status === StreamStatus.ENDED) {
      throw new BadRequestException('Stream has ended');
    }
    if (!stream.streamKey) {
      throw new BadRequestException('Stream key is not available');
    }

    const roomName = this.roomName(streamId);
    const roomService = this.roomClient();
    try {
      await roomService.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 2 });
    } catch (err) {
      this.logger.debug(`LiveKit room create: ${err instanceof Error ? err.message : err}`);
    }

    const token = new AccessToken(
      this.configService.get<string>('livekit.apiKey')!,
      this.configService.get<string>('livekit.apiSecret')!,
      { identity: userId, ttl: '2h' },
    );
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    return { token: await token.toJwt(), roomName };
  }

  async startBrowserEgress(streamId: string, userId: string): Promise<{ egressId: string }> {
    const stream = await this.streamingService.findById(streamId);
    if (stream.userId !== userId) throw new NotFoundException('Stream not found');
    if (!stream.streamKey) throw new BadRequestException('Stream key is not available');

    const existing = this.activeEgress.get(streamId) ?? stream.livekitEgressId;
    if (existing) {
      this.activeEgress.set(streamId, existing);
      return { egressId: existing };
    }

    const egress = this.egressClient();
    const roomName = this.roomName(streamId);
    const rtmpUrl = `rtmps://global-live.mux.com:443/app/${stream.streamKey}`;

    const info = await egress.startRoomCompositeEgress(roomName, {
      stream: new StreamOutput({
        protocol: StreamProtocol.RTMP,
        urls: [rtmpUrl],
      }),
    });

    this.activeEgress.set(streamId, info.egressId);
    await this.streamingService.setLivekitEgressId(streamId, info.egressId);
    return { egressId: info.egressId };
  }

  async stopBrowserEgress(streamId: string, userId: string): Promise<void> {
    const stream = await this.streamingService.findById(streamId);
    if (stream.userId !== userId) throw new NotFoundException('Stream not found');

    const egressId = this.activeEgress.get(streamId) ?? stream.livekitEgressId;
    if (!egressId) return;

    try {
      await this.egressClient().stopEgress(egressId);
    } catch (err) {
      this.logger.warn(`Stop egress failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      this.activeEgress.delete(streamId);
      await this.streamingService.setLivekitEgressId(streamId, null);
    }
  }

  private roomClient(): RoomServiceClient {
    const host = this.livekitHost();
    return new RoomServiceClient(
      host,
      this.configService.get<string>('livekit.apiKey')!,
      this.configService.get<string>('livekit.apiSecret')!,
    );
  }

  private egressClient(): EgressClient {
    const host = this.livekitHost();
    return new EgressClient(
      host,
      this.configService.get<string>('livekit.apiKey')!,
      this.configService.get<string>('livekit.apiSecret')!,
    );
  }

  private livekitHost(): string {
    const url = this.configService.get<string>('livekit.url')!;
    return url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  }
}
