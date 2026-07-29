import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { ForbiddenException, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { safeRedisGet, safeRedisSetex } from '../common/redis/redis-safe.util';
import { JwtService } from '@nestjs/jwt';
import { Namespace, Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, type RedisClientOptions, type RedisClientType } from 'redis';
import { redisTlsOptions } from '../common/redis/redis-tls.util';
import { socketIoCorsOptions } from './socket-cors.util';
import { StreamViewerService } from '../modules/streaming/stream-viewer.service';
import { StreamingService } from '../modules/streaming/streaming.service';
import { MuxLiveSyncService } from '../modules/streaming/mux-live-sync.service';
import { StreamReactionService } from '../modules/streaming/stream-reaction.service';
import { VideosService } from '../modules/content/videos.service';
import { CommunitiesService } from '../modules/communities/communities.service';
import { CommunityRoomsService } from '../modules/communities/community-rooms.service';
import { DirectMessagesService } from '../modules/direct-messages/direct-messages.service';
import { recordSocketJoinDenial } from '../common/metrics/forge-metrics';
import { JwtPayload } from '../modules/auth/strategies/jwt.strategy';
import { UserRole } from '../modules/users/entities/user.entity';
import { StreamStatus } from '../modules/streaming/entities/stream.entity';
import { SocketIoHub } from './socket-io.hub';

type SocketAuthData = {
  userId?: string;
  role?: UserRole;
  watchingStreamId?: string;
};

@WebSocketGateway({
  cors: socketIoCorsOptions(),
  namespace: '/events',
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private userSockets = new Map<string, Set<string>>();
  private static readonly SOCKET_ACCESS_CACHE_TTL_SEC = 60;
  private static readonly SOCKET_JOIN_RATE_SEC = 3;
  private redisPubClient: RedisClientType | null = null;
  private redisSubClient: RedisClientType | null = null;

  private async assertSocketJoinRate(userId: string, scope: string): Promise<void> {
    const key = `socket:join:rate:${scope}:${userId}`;
    const set = await this.redis.set(key, '1', 'EX', EventsGateway.SOCKET_JOIN_RATE_SEC, 'NX');
    if (set !== 'OK') {
      throw new WsException('Too many join requests — slow down');
    }
  }

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly streamViewerService: StreamViewerService,
    private readonly streamingService: StreamingService,
    private readonly muxLiveSyncService: MuxLiveSyncService,
    private readonly streamReactionService: StreamReactionService,
    private readonly videosService: VideosService,
    private readonly communitiesService: CommunitiesService,
    private readonly communityRoomsService: CommunityRoomsService,
    private readonly directMessagesService: DirectMessagesService,
    private readonly socketIoHub: SocketIoHub,
  ) {}

  async afterInit() {
    this.socketIoHub.setServer(this.server);
    const url = this.configService.get<string>('redis.url');
    if (!url) {
      this.logger.warn('Redis URL missing; Socket.IO runs without Redis adapter (single replica only)');
      this.logger.log('WebSocket gateway initialized');
      return;
    }
    try {
      const nodeEnv = this.configService.get<string>('nodeEnv') || 'development';
      const clientOptions = this.redisSocketOptions(url, nodeEnv);
      const pubClient = createClient(clientOptions) as RedisClientType;
      const subClient = pubClient.duplicate() as RedisClientType;
      pubClient.on('error', (err) => this.logger.error(`Redis pub client: ${err.message}`));
      subClient.on('error', (err) => this.logger.error(`Redis sub client: ${err.message}`));
      await Promise.all([pubClient.connect(), subClient.connect()]);
      this.redisPubClient = pubClient;
      this.redisSubClient = subClient;
      const io = this.socketIoServer();
      io.adapter(createAdapter(pubClient, subClient));
      this.logger.log('WebSocket gateway initialized with Redis adapter (multi-replica ready)');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Socket.IO Redis adapter failed (${msg}); continuing single-replica. Ensure REDIS_URL and Redis availability for horizontal scale.`,
      );
      this.logger.log('WebSocket gateway initialized');
    }
  }

  async onModuleDestroy() {
    const clients = [this.redisPubClient, this.redisSubClient];
    this.redisPubClient = null;
    this.redisSubClient = null;
    await Promise.all(
      clients.map(async (client) => {
        if (!client?.isOpen) return;
        try {
          await client.quit();
        } catch {
          try {
            client.disconnect();
          } catch {
            // ignore shutdown races
          }
        }
      }),
    );
  }

  handleConnection(client: Socket) {
    let userId: string | null = null;
    try {
      userId = this.resolveUserId(client);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Socket ${client.id} auth failed: ${msg}`);
      client.disconnect(true);
      return;
    }
    if (userId) {
      if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
      this.userSockets.get(userId)!.add(client.id);
      client.join(`user:${userId}`);
      const data = client.data as SocketAuthData;
      data.userId = userId;
      data.role = this.resolveRole(client) ?? UserRole.USER;
    }
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const data = client.data as SocketAuthData;
    const userId = data.userId;
    const watchingStreamId = data.watchingStreamId;
    if (userId) {
      this.userSockets.get(userId)?.delete(client.id);
    }
    if (watchingStreamId) {
      void this.streamViewerService.leave(watchingStreamId, client.id).then((count) => {
        this.server
          .to(`stream:${watchingStreamId}`)
          .emit('stream:viewer-count', { streamId: watchingStreamId, viewerCount: count });
      });
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private resolveRole(client: Socket): UserRole | null {
    const auth = client.handshake.auth as { token?: string };
    const secret = this.configService.get<string>('jwt.secret');
    if (!secret || !auth.token) return null;
    try {
      const payload = this.jwtService.verify<JwtPayload>(auth.token, { secret });
      return payload.role;
    } catch {
      return null;
    }
  }

  private requireAuth(client: Socket): { userId: string; role: UserRole } {
    const data = client.data as SocketAuthData;
    if (!data.userId) {
      throw new WsException('Authentication required');
    }
    return { userId: data.userId, role: data.role ?? UserRole.USER };
  }

  private denyAccess(message = 'Access denied'): never {
    throw new WsException(message);
  }

  private async assertStreamAccess(
    streamId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const allowed = await this.streamingService.assertStreamSocketAccess(streamId, userId, role);
    if (!allowed) {
      this.denyAccess();
    }
  }

  private async assertVideoAccess(
    videoId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const cacheKey = `ent:video-access:${userId}:${videoId}`;
    const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
    if (cached === '1') return;
    if (cached === '0') this.denyAccess();

    try {
      const video = await this.videosService.getVideoForViewer(videoId, userId, role);
      const allowed = !video.accessDenied;
      await safeRedisSetex(
        this.redis,
        cacheKey,
        EventsGateway.SOCKET_ACCESS_CACHE_TTL_SEC,
        allowed ? '1' : '0',
        this.logger,
      );
      if (!allowed) {
        this.denyAccess();
      }
    } catch (err) {
      if (err instanceof ForbiddenException) {
        this.denyAccess();
      }
      throw err;
    }
  }

  private async assertChannelAccess(
    channelId: string,
    userId: string,
    role: UserRole,
  ): Promise<void> {
    const cacheKey = `ent:channel-access:${userId}:${channelId}`;
    const cached = await safeRedisGet(this.redis, cacheKey, this.logger);
    if (cached === '1') return;
    if (cached === '0') this.denyAccess();

    try {
      await this.communitiesService.verifyChannelAccess(channelId, userId, role);
      await safeRedisSetex(
        this.redis,
        cacheKey,
        EventsGateway.SOCKET_ACCESS_CACHE_TTL_SEC,
        '1',
        this.logger,
      );
    } catch (err) {
      if (err instanceof ForbiddenException) {
        await safeRedisSetex(
          this.redis,
          cacheKey,
          EventsGateway.SOCKET_ACCESS_CACHE_TTL_SEC,
          '0',
          this.logger,
        );
        this.denyAccess();
      }
      throw err;
    }
  }

  private async assertConversationAccess(conversationId: string, userId: string): Promise<void> {
    try {
      await this.directMessagesService.assertMember(userId, conversationId);
    } catch (err) {
      if (err instanceof ForbiddenException) {
        this.denyAccess();
      }
      throw err;
    }
  }

  private resolveUserId(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string; userId?: string };
    const secret = this.configService.get<string>('jwt.secret');
    if (!secret) return null;

    if (auth.token) {
      try {
        const payload = this.jwtService.verify<{ sub: string }>(auth.token, { secret });
        return payload.sub;
      } catch {
        return null;
      }
    }

    // Legacy clients — ignore unverified userId (do not join user room)
    if (auth.userId) {
      this.logger.warn(`Socket ${client.id} connected with legacy userId auth; use token instead`);
    }
    return null;
  }

  @SubscribeMessage('join-live-feed')
  handleJoinLiveFeed(@ConnectedSocket() client: Socket) {
    this.requireAuth(client);
    client.join('streams:live');
    return { event: 'joined-live-feed', data: { ok: true } };
  }

  @SubscribeMessage('leave-live-feed')
  handleLeaveLiveFeed(@ConnectedSocket() client: Socket) {
    client.leave('streams:live');
  }

  @SubscribeMessage('join-stream')
  async handleJoinStream(
    @MessageBody() data: { streamId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, role } = this.requireAuth(client);
    await this.assertStreamAccess(data.streamId, userId, role);
    client.join(`stream:${data.streamId}`);
    (client.data as SocketAuthData).watchingStreamId = data.streamId;
    const count = await this.streamViewerService.join(data.streamId, client.id, userId);
    this.server
      .to(`stream:${data.streamId}`)
      .emit('stream:viewer-count', { streamId: data.streamId, viewerCount: count });

    // Late joiners (page refresh, viewer reconnect) must see host-reconnect state
    // immediately rather than waiting for the next stream:reconnecting broadcast.
    let reconnecting = false;
    let since: string | null = null;
    let timeoutSec: number | null = null;
    try {
      const stream = await this.streamingService.findById(data.streamId);
      reconnecting = stream.status === StreamStatus.LIVE && !!stream.muxIdleSince;
      if (reconnecting) {
        since = stream.muxIdleSince!.toISOString();
        timeoutSec = this.muxLiveSyncService.reconnectGraceSec();
      }
    } catch {
      // stream lookup best-effort here — assertStreamAccess already validated it exists
    }

    return {
      event: 'joined-stream',
      data: { streamId: data.streamId, viewerCount: count, reconnecting, since, timeoutSec },
    };
  }

  @SubscribeMessage('join-video')
  async handleJoinVideo(
    @MessageBody() data: { videoId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, role } = this.requireAuth(client);
    await this.assertVideoAccess(data.videoId, userId, role);
    client.join(`video:${data.videoId}`);
    return { event: 'joined-video', data: { videoId: data.videoId } };
  }

  @SubscribeMessage('leave-stream')
  async handleLeaveStream(
    @MessageBody() data: { streamId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`stream:${data.streamId}`);
    const clientData = client.data as SocketAuthData;
    if (clientData.watchingStreamId === data.streamId) {
      delete clientData.watchingStreamId;
    }
    const count = await this.streamViewerService.leave(data.streamId, client.id);
    this.server
      .to(`stream:${data.streamId}`)
      .emit('stream:viewer-count', { streamId: data.streamId, viewerCount: count });
  }

  @SubscribeMessage('leave-video')
  handleLeaveVideo(@MessageBody() data: { videoId: string }, @ConnectedSocket() client: Socket) {
    client.leave(`video:${data.videoId}`);
  }

  @SubscribeMessage('stream:react')
  async handleStreamReact(
    @MessageBody() data: { streamId: string; reaction: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, role } = this.requireAuth(client);
    await this.assertStreamAccess(data.streamId, userId, role);
    const reaction = (data.reaction || 'heart').slice(0, 32);
    const result = await this.streamReactionService.react(data.streamId, reaction);
    return { event: 'stream:reaction', data: { streamId: data.streamId, ...result } };
  }

  @SubscribeMessage('join-conversation')
  async handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId } = this.requireAuth(client);
    await this.assertConversationAccess(data.conversationId, userId);
    client.join(`conversation:${data.conversationId}`);
    return { event: 'joined-conversation', data: { conversationId: data.conversationId, userId } };
  }

  @SubscribeMessage('leave-conversation')
  handleLeaveConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('join-stream-chat')
  async handleJoinStreamChat(
    @MessageBody() data: { streamId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, role } = this.requireAuth(client);
    await this.assertStreamAccess(data.streamId, userId, role);
    client.join(`stream:${data.streamId}`);
    return { event: 'joined-stream-chat', data: { streamId: data.streamId } };
  }

  @SubscribeMessage('leave-stream-chat')
  handleLeaveStreamChat(@MessageBody() data: { streamId: string }, @ConnectedSocket() client: Socket) {
    client.leave(`stream:${data.streamId}`);
  }

  @SubscribeMessage('join-community')
  async handleJoinCommunity(
    @MessageBody() data: { communityId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, role } = this.requireAuth(client);
    try {
      await this.assertSocketJoinRate(userId, `community:${data.communityId}`);
      await this.communitiesService.assertCommunityAccess(data.communityId, userId, role);
      client.join(`community:${data.communityId}`);
      return { event: 'joined-community', data: { communityId: data.communityId } };
    } catch (err) {
      recordSocketJoinDenial('community');
      throw err;
    }
  }

  @SubscribeMessage('leave-community')
  handleLeaveCommunity(
    @MessageBody() data: { communityId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`community:${data.communityId}`);
  }

  @SubscribeMessage('join-channel')
  async handleJoinChannel(
    @MessageBody() data: { channelId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, role } = this.requireAuth(client);
    try {
      await this.assertSocketJoinRate(userId, `channel:${data.channelId}`);
      await this.assertChannelAccess(data.channelId, userId, role);
      client.join(`channel:${data.channelId}`);
      return { event: 'joined-channel', data: { channelId: data.channelId } };
    } catch (err) {
      recordSocketJoinDenial('channel');
      throw err;
    }
  }

  @SubscribeMessage('leave-channel')
  handleLeaveChannel(@MessageBody() data: { channelId: string }, @ConnectedSocket() client: Socket) {
    client.leave(`channel:${data.channelId}`);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @MessageBody() data: { communityId: string; roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, role } = this.requireAuth(client);
    try {
      await this.assertSocketJoinRate(userId, `room:${data.roomId}`);
      await this.communityRoomsService.assertRoomAccess(
        data.communityId,
        data.roomId,
        userId,
        role,
      );
      client.join(`room:${data.roomId}`);
      return { event: 'joined-room', data: { roomId: data.roomId } };
    } catch (err) {
      recordSocketJoinDenial('room');
      throw err;
    }
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(@MessageBody() data: { roomId: string }, @ConnectedSocket() client: Socket) {
    client.leave(`room:${data.roomId}`);
  }

  @SubscribeMessage('join-stream-vip')
  async handleJoinStreamVip(
    @MessageBody() data: { streamId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId, role } = this.requireAuth(client);
    await this.streamingService.assertVipAccess(data.streamId, userId, role);
    client.join(`stream:${data.streamId}:vip`);
    return { event: 'joined-stream-vip', data: { streamId: data.streamId } };
  }

  @SubscribeMessage('leave-stream-vip')
  handleLeaveStreamVip(@MessageBody() data: { streamId: string }, @ConnectedSocket() client: Socket) {
    client.leave(`stream:${data.streamId}:vip`);
  }

  @SubscribeMessage('join-creator-analytics')
  handleJoinCreatorAnalytics(@ConnectedSocket() client: Socket) {
    const { userId } = this.requireAuth(client);
    client.join(`analytics:creator:${userId}`);
    return { event: 'joined-creator-analytics', data: { creatorId: userId } };
  }

  @SubscribeMessage('leave-creator-analytics')
  handleLeaveCreatorAnalytics(@ConnectedSocket() client: Socket) {
    const { userId } = this.requireAuth(client);
    client.leave(`analytics:creator:${userId}`);
  }

  emitToRoom(room: string, event: string, data: unknown) {
    this.server.to(room).emit(event, data);
  }

  /** Nest may expose the namespace or root Server; adapter must attach to the root IO instance. */
  private socketIoServer(): Server {
    const srv = this.server;
    const parent = (srv as unknown as Namespace).server;
    if (parent && typeof parent.adapter === 'function') return parent;
    return srv;
  }

  private redisSocketOptions(url: string, nodeEnv: string): RedisClientOptions {
    const options: RedisClientOptions = { url };
    const tls = redisTlsOptions(url, nodeEnv);
    if (tls) {
      options.socket = {
        tls: true,
        rejectUnauthorized: tls.tls.rejectUnauthorized,
      };
    }
    return options;
  }
}
